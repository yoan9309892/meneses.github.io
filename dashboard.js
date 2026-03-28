// Configuración de Supabase - CONFIGURADO CON TUS DATOS
const SUPABASE_URL = 'https://xfrinzuhsoqjeirnvlic.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cmocaMaQYi8tbZVMsZdsMA_tAL7le4N';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function verificarAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    cargarMisProductos();
    cargarEstadisticas();
}

async function cargarMisProductos() {
    const container = document.getElementById('misProductos');
    if (!container) return;
    
    const { data: productos, error } = await supabase
        .from('productos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        container.innerHTML = '<div class="alert alert-error">Error al cargar productos</div>';
        return;
    }
    
    if (productos.length === 0) {
        container.innerHTML = '<div class="loading">📦 No tienes productos publicados. ¡Crea tu primer producto!</div>';
        return;
    }
    
    container.innerHTML = productos.map(producto => `
        <div class="producto-card">
            <img src="${producto.imagen_url || 'https://via.placeholder.com/300x200?text=Sin+imagen'}" 
                 class="producto-imagen">
            <div class="producto-info">
                <div class="producto-categoria">${producto.categoria || 'Sin categoría'}</div>
                <h3 class="producto-titulo">${escapeHtml(producto.titulo)}</h3>
                <div class="producto-precio">$${producto.precio}</div>
                <div class="producto-stock">📦 Stock: ${producto.stock} unidades</div>
                <p class="producto-descripcion">${escapeHtml(producto.descripcion?.substring(0, 100) || '')}</p>
                <button onclick="editarProducto(${producto.id})" class="btn-secondary" style="margin-top: 10px;">✏️ Editar Stock</button>
                <button onclick="eliminarProducto(${producto.id})" class="btn-danger" style="margin-top: 10px;">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function cargarEstadisticas() {
    const { data: productos } = await supabase
        .from('productos')
        .select('*')
        .eq('user_id', currentUser.id);
    
    document.getElementById('totalProductos').textContent = productos?.length || 0;
    
    const { data: ventas } = await supabase
        .from('ventas')
        .select('*')
        .eq('vendedor_id', currentUser.id);
    
    const totalVendidos = ventas?.reduce((sum, v) => sum + v.cantidad, 0) || 0;
    document.getElementById('totalVendidos').textContent = totalVendidos;
    
    const totalGanado = ventas?.reduce((sum, v) => sum + v.total, 0) || 0;
    document.getElementById('totalGanado').textContent = `$${totalGanado.toFixed(2)}`;
}

function mostrarFormularioProducto() {
    document.getElementById('addProductModal').style.display = 'flex';
}

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const titulo = document.getElementById('titulo').value;
    const categoria = document.getElementById('categoria').value;
    const descripcion = document.getElementById('descripcion').value;
    const precio = parseFloat(document.getElementById('precio').value);
    const stock = parseInt(document.getElementById('stock').value);
    const imagen_url = document.getElementById('imagenUrl').value || null;
    
    const { error } = await supabase
        .from('productos')
        .insert([{
            titulo,
            categoria,
            descripcion,
            precio,
            stock,
            imagen_url,
            user_id: currentUser.id
        }]);
    
    if (error) {
        alert('Error al publicar: ' + error.message);
    } else {
        alert('¡Producto publicado con éxito!');
        cerrarModal('addProductModal');
        document.getElementById('productForm').reset();
        cargarMisProductos();
        cargarEstadisticas();
    }
});

async function editarProducto(productoId) {
    const { data: producto } = await supabase
        .from('productos')
        .select('stock')
        .eq('id', productoId)
        .single();
    
    const nuevoStock = prompt('Nuevo stock:', producto.stock);
    if (nuevoStock !== null && !isNaN(nuevoStock) && parseInt(nuevoStock) >= 0) {
        const { error } = await supabase
            .from('productos')
            .update({ stock: parseInt(nuevoStock) })
            .eq('id', productoId);
        
        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Stock actualizado');
            cargarMisProductos();
            cargarEstadisticas();
        }
    }
}

async function eliminarProducto(productoId) {
    const confirmar = confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.');
    if (!confirmar) return;
    
    const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productoId);
    
    if (error) {
        alert('Error: ' + error.message);
    } else {
        alert('Producto eliminado');
        cargarMisProductos();
        cargarEstadisticas();
    }
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    verificarAuth();
    
    const authBtn = document.getElementById('authButton');
    if (authBtn) authBtn.addEventListener('click', cerrarSesion);
});