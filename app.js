// Configuración de Supabase - YA CONFIGURADO CON TUS DATOS
const SUPABASE_URL = 'https://xfrinzuhsoqjeirnvlic.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cmocaMaQYi8tbZVMsZdsMA_tAL7le4N';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let carrito = [];

function cargarCarrito() {
    const guardado = localStorage.getItem('marketplace_cart');
    if (guardado) {
        carrito = JSON.parse(guardado);
    }
    actualizarContadorCarrito();
}

function guardarCarrito() {
    localStorage.setItem('marketplace_cart', JSON.stringify(carrito));
    actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        const total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
        cartCount.textContent = total;
    }
}

function agregarAlCarrito(producto, cantidad = 1) {
    const existente = carrito.find(item => item.id === producto.id);
    
    if (existente) {
        existente.cantidad += cantidad;
    } else {
        carrito.push({
            id: producto.id,
            titulo: producto.titulo,
            precio: producto.precio,
            imagen_url: producto.imagen_url,
            cantidad: cantidad,
            vendedor_id: producto.user_id
        });
    }
    
    guardarCarrito();
    mostrarNotificacion(`${producto.titulo} agregado al carrito`, 'success');
}

function mostrarCarrito() {
    const container = document.getElementById('cartItems');
    const totalDiv = document.getElementById('cartTotal');
    
    if (!container) return;
    
    if (carrito.length === 0) {
        container.innerHTML = '<p class="text-center">🛒 Tu carrito está vacío</p>';
        totalDiv.innerHTML = '';
        return;
    }
    
    container.innerHTML = carrito.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-title">${escapeHtml(item.titulo)}</div>
                <div class="cart-item-price">$${item.precio}</div>
            </div>
            <div class="cart-item-controls">
                <button onclick="modificarCantidad(${item.id}, -1)" class="btn-secondary" style="padding: 4px 8px;">-</button>
                <span style="min-width: 40px; text-align: center;">${item.cantidad}</span>
                <button onclick="modificarCantidad(${item.id}, 1)" class="btn-secondary" style="padding: 4px 8px;">+</button>
                <button onclick="eliminarDelCarrito(${item.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `).join('');
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    totalDiv.innerHTML = `<strong>Total: $${total.toFixed(2)}</strong>`;
}

function modificarCantidad(productoId, cambio) {
    const item = carrito.find(item => item.id === productoId);
    if (item) {
        item.cantidad += cambio;
        if (item.cantidad <= 0) {
            carrito = carrito.filter(item => item.id !== productoId);
        }
        guardarCarrito();
        mostrarCarrito();
        actualizarContadorCarrito();
    }
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.id !== productoId);
    guardarCarrito();
    mostrarCarrito();
    actualizarContadorCarrito();
    mostrarNotificacion('Producto eliminado del carrito', 'info');
}

async function procesarCompra() {
    if (!currentUser) {
        mostrarNotificacion('Debes iniciar sesión para comprar', 'error');
        mostrarAuthModal();
        return;
    }
    
    if (carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'error');
        return;
    }
    
    for (const item of carrito) {
        const { data: producto } = await supabase
            .from('productos')
            .select('stock')
            .eq('id', item.id)
            .single();
        
        if (!producto || producto.stock < item.cantidad) {
            mostrarNotificacion(`No hay suficiente stock de ${item.titulo}`, 'error');
            return;
        }
    }
    
    for (const item of carrito) {
        const { data: producto } = await supabase
            .from('productos')
            .select('stock')
            .eq('id', item.id)
            .single();
        
        const nuevoStock = producto.stock - item.cantidad;
        
        await supabase
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', item.id);
        
        await supabase
            .from('ventas')
            .insert({
                producto_id: item.id,
                comprador_id: currentUser.id,
                vendedor_id: item.vendedor_id,
                cantidad: item.cantidad,
                precio_unitario: item.precio,
                total: item.precio * item.cantidad
            });
    }
    
    carrito = [];
    guardarCarrito();
    actualizarContadorCarrito();
    cerrarModal('cartModal');
    mostrarNotificacion('¡Compra realizada con éxito!', 'success');
}

async function cargarProductos(busqueda = '', categoria = '') {
    const container = document.getElementById('productosContainer');
    if (!container) return;
    
    let query = supabase
        .from('productos')
        .select('*')
        .gt('stock', 0)
        .order('created_at', { ascending: false });
    
    if (busqueda) {
        query = query.ilike('titulo', `%${busqueda}%`);
    }
    
    if (categoria) {
        query = query.eq('categoria', categoria);
    }
    
    const { data: productos, error } = await query;
    
    if (error) {
        container.innerHTML = '<div class="alert alert-error">Error al cargar productos</div>';
        return;
    }
    
    if (productos.length === 0) {
        container.innerHTML = '<div class="loading">No hay productos disponibles</div>';
        return;
    }
    
    container.innerHTML = productos.map(producto => `
        <div class="producto-card">
            <img src="${producto.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+imagen'}" 
                 class="producto-imagen" 
                 onerror="this.src='https://via.placeholder.com/300x200?text=Sin+imagen'">
            <div class="producto-info">
                <div class="producto-categoria">${producto.categoria || 'Sin categoría'}</div>
                <h3 class="producto-titulo">${escapeHtml(producto.titulo)}</h3>
                <div class="producto-precio">$${producto.precio}</div>
                <div class="producto-stock">📦 Stock: ${producto.stock} unidades</div>
                <p class="producto-descripcion">${escapeHtml(producto.descripcion?.substring(0, 80) || '')}...</p>
                <div class="cantidad-selector">
                    <label>Cantidad: </label>
                    <input type="number" id="cantidad_${producto.id}" value="1" min="1" max="${producto.stock}" style="width: 70px; margin: 10px 0;">
                </div>
                <button onclick="agregarConCantidad(${producto.id})" class="btn-primary add-to-cart-btn">🛒 Agregar al Carrito</button>
                <button onclick="verProducto(${producto.id})" class="btn-secondary" style="margin-top: 5px;">Ver detalles</button>
            </div>
        </div>
    `).join('');
}

function agregarConCantidad(productoId) {
    const cantidadInput = document.getElementById(`cantidad_${productoId}`);
    const cantidad = parseInt(cantidadInput.value) || 1;
    
    const productoCard = document.querySelector(`.producto-card:has(#cantidad_${productoId})`);
    const titulo = productoCard.querySelector('.producto-titulo').textContent;
    const precio = parseFloat(productoCard.querySelector('.producto-precio').textContent.replace('$', ''));
    const imagen = productoCard.querySelector('.producto-imagen').src;
    
    agregarAlCarrito({
        id: productoId,
        titulo: titulo,
        precio: precio,
        imagen_url: imagen,
        user_id: null
    }, cantidad);
}

async function verProducto(id) {
    const { data: producto, error } = await supabase
        .from('productos')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) return;
    
    const { data: vendedor } = await supabase
        .from('perfiles')
        .select('nombre, telefono')
        .eq('id', producto.user_id)
        .single();
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <h2>${escapeHtml(producto.titulo)}</h2>
        <img src="${producto.imagen_url || 'https://via.placeholder.com/400x300?text=Sin+imagen'}" 
             style="width:100%; margin: 20px 0; border-radius: 8px;">
        <p><strong>Categoría:</strong> ${producto.categoria || 'Sin categoría'}</p>
        <p><strong>Precio:</strong> $${producto.precio}</p>
        <p><strong>Stock disponible:</strong> ${producto.stock} unidades</p>
        <p><strong>Descripción:</strong></p>
        <p>${escapeHtml(producto.descripcion)}</p>
        <p><strong>Vendedor:</strong> ${escapeHtml(vendedor?.nombre || 'Usuario')}</p>
        ${vendedor?.telefono ? `<p><strong>Contacto:</strong> ${vendedor.telefono}</p>` : ''}
        <div class="cantidad-selector" style="margin-top: 20px;">
            <label>Cantidad a comprar: </label>
            <input type="number" id="modal_cantidad" value="1" min="1" max="${producto.stock}" style="width: 80px;">
        </div>
        <button onclick="agregarDesdeModal(${producto.id}, ${producto.precio}, '${escapeHtml(producto.titulo).replace(/'/g, "\\'")}', '${producto.imagen_url || ''}')" class="btn-primary" style="margin-top: 10px;">Agregar al Carrito</button>
    `;
    
    document.getElementById('productModal').style.display = 'flex';
}

function agregarDesdeModal(id, precio, titulo, imagen) {
    const cantidad = parseInt(document.getElementById('modal_cantidad').value) || 1;
    agregarAlCarrito({
        id: id,
        titulo: titulo,
        precio: precio,
        imagen_url: imagen,
        user_id: null
    }, cantidad);
    cerrarModal('productModal');
}

async function verificarUsuario() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    actualizarUI();
    
    if (document.getElementById('productosContainer')) {
        cargarProductos();
    }
}

function actualizarUI() {
    const authBtn = document.getElementById('authButton');
    const dashboardLink = document.getElementById('dashboardLink');
    const perfilLink = document.getElementById('perfilLink');
    
    if (currentUser) {
        if (authBtn) authBtn.textContent = 'Cerrar Sesión';
        if (dashboardLink) dashboardLink.style.display = 'inline';
        if (perfilLink) perfilLink.style.display = 'inline';
    } else {
        if (authBtn) authBtn.textContent = 'Iniciar Sesión';
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (perfilLink) perfilLink.style.display = 'none';
    }
}

async function manejarAuth() {
    if (currentUser) {
        await supabase.auth.signOut();
        currentUser = null;
        actualizarUI();
        location.reload();
    } else {
        mostrarAuthModal();
    }
}

function mostrarAuthModal() {
    const html = `
        <div id="authModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="cerrarModal('authModal')">&times;</span>
                <h2 id="authTitle">Iniciar Sesión</h2>
                <div id="authForm">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <input type="password" id="password" required>
                    </div>
                    <button onclick="iniciarSesion()" class="btn-primary">Iniciar Sesión</button>
                    <p style="margin-top: 10px; text-align: center;">
                        ¿No tienes cuenta? 
                        <a href="#" onclick="cambiarARegistro()">Regístrate</a>
                    </p>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('authModal').style.display = 'flex';
}

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
        cerrarModal('authModal');
        location.reload();
    }
}

async function registrar() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const nombre = document.getElementById('nombre')?.value || email.split('@')[0];
    
    const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre } }
    });
    
    if (error) {
        mostrarNotificacion('Error: ' + error.message, 'error');
    } else {
        mostrarNotificacion('¡Registro exitoso! Revisa tu email para confirmar la cuenta.', 'success');
        cerrarModal('authModal');
    }
}

function cambiarARegistro() {
    const form = document.getElementById('authForm');
    const title = document.getElementById('authTitle');
    
    title.textContent = 'Crear Cuenta';
    form.innerHTML = `
        <div class="form-group">
            <label>Nombre</label>
            <input type="text" id="nombre" required>
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" required>
        </div>
        <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="password" required>
        </div>
        <button onclick="registrar()" class="btn-primary">Registrarse</button>
        <p style="margin-top: 10px; text-align: center;">
            ¿Ya tienes cuenta? 
            <a href="#" onclick="cambiarALogin()">Iniciar Sesión</a>
        </p>
    `;
}

function cambiarALogin() {
    const form = document.getElementById('authForm');
    const title = document.getElementById('authTitle');
    
    title.textContent = 'Iniciar Sesión';
    form.innerHTML = `
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" required>
        </div>
        <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="password" required>
        </div>
        <button onclick="iniciarSesion()" class="btn-primary">Iniciar Sesión</button>
        <p style="margin-top: 10px; text-align: center;">
            ¿No tienes cuenta? 
            <a href="#" onclick="cambiarARegistro()">Regístrate</a>
        </p>
    `;
}

function mostrarNotificacion(mensaje, tipo) {
    const notif = document.createElement('div');
    notif.className = `alert alert-${tipo}`;
    notif.textContent = mensaje;
    notif.style.position = 'fixed';
    notif.style.top = '20px';
    notif.style.right = '20px';
    notif.style.zIndex = '2000';
    notif.style.maxWidth = '300px';
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.remove();
    }, 3000);
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    cargarCarrito();
    verificarUsuario();
    
    const authBtn = document.getElementById('authButton');
    if (authBtn) authBtn.addEventListener('click', manejarAuth);
    
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            mostrarCarrito();
            const cartModal = document.getElementById('cartModal');
            if (cartModal) cartModal.style.display = 'flex';
        });
    }
    
    const searchInput = document.getElementById('searchInput');
    const categoriaFilter = document.getElementById('categoriaFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            cargarProductos(e.target.value, categoriaFilter?.value || '');
        });
    }
    
    if (categoriaFilter) {
        categoriaFilter.addEventListener('change', (e) => {
            cargarProductos(searchInput?.value || '', e.target.value);
        });
    }
    
    window.onclick = (event) => {
        const productModal = document.getElementById('productModal');
        if (event.target === productModal) {
            productModal.style.display = 'none';
        }
        const cartModal = document.getElementById('cartModal');
        if (event.target === cartModal) {
            cartModal.style.display = 'none';
        }
    };
});