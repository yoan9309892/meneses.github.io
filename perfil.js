// Configuración de Supabase - CONFIGURADO CON TUS DATOS
const SUPABASE_URL = 'https://xfrinzuhsoqjeirnvlic.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cmocaMaQYi8tbZVMsZdsMA_tAL7le4N';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function cargarPerfil() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    
    const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    document.getElementById('nombre').value = perfil?.nombre || '';
    document.getElementById('email').value = user.email;
    document.getElementById('telefono').value = perfil?.telefono || '';
    document.getElementById('direccion').value = perfil?.direccion || '';
    
    cargarHistorialCompras();
}

async function actualizarPerfil() {
    const nombre = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const direccion = document.getElementById('direccion').value;
    
    const { error } = await supabase
        .from('perfiles')
        .upsert({
            id: currentUser.id,
            nombre,
            telefono,
            direccion
        });
    
    const mensajeDiv = document.getElementById('mensaje');
    
    if (error) {
        mensajeDiv.innerHTML = '<div class="alert alert-error">❌ Error al actualizar: ' + error.message + '</div>';
    } else {
        mensajeDiv.innerHTML = '<div class="alert alert-success">✅ ¡Perfil actualizado con éxito!</div>';
        setTimeout(() => {
            mensajeDiv.innerHTML = '';
        }, 3000);
    }
}

async function cargarHistorialCompras() {
    const container = document.getElementById('historialCompras');
    if (!container) return;
    
    const { data: compras, error } = await supabase
        .from('ventas')
        .select(`
            *,
            productos (titulo, imagen_url)
        `)
        .eq('comprador_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        container.innerHTML = '<div class="alert alert-error">Error al cargar historial</div>';
        return;
    }
    
    if (!compras || compras.length === 0) {
        container.innerHTML = '<p class="loading">📭 No has realizado compras aún</p>';
        return;
    }
    
    container.innerHTML = compras.map(compra => `
        <div class="historial-item">
            <div>
                <strong>${escapeHtml(compra.productos?.titulo || 'Producto')}</strong>
                <div>Cantidad: ${compra.cantidad}</div>
                <div>Precio unitario: $${compra.precio_unitario}</div>
            </div>
            <div style="text-align: right;">
                <div><strong>Total: $${compra.total}</strong></div>
                <div style="font-size: 0.85rem; color: #666;">${new Date(compra.created_at).toLocaleDateString('es-ES')}</div>
            </div>
        </div>
    `).join('');
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
    cargarPerfil();
    
    const authBtn = document.getElementById('authButton');
    if (authBtn) authBtn.addEventListener('click', cerrarSesion);
});