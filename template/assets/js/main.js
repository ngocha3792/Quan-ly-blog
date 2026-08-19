(function () {
    const body = document.body;
    const savedTheme = localStorage.getItem('demoTheme');
    if (savedTheme === 'dark') body.classList.add('dark-mode');
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        localStorage.setItem('demoTheme', body.classList.contains('dark-mode') ? 'dark' : 'light')
    }));

    function setRole(role) {
        localStorage.setItem('demoRole', role);
        applyRole(role)
    }

    function applyRole(role) {
        document.querySelectorAll('.guest-only').forEach(e => e.classList.toggle('d-none', role !== 'guest'));
        document.querySelectorAll('.user-only').forEach(e => e.classList.toggle('d-none', role === 'guest'));
        document.querySelectorAll('.role-owner,.role-mod,.role-admin').forEach(e => e.classList.add('d-none'));
        if (role === 'owner') document.querySelectorAll('.role-owner').forEach(e => e.classList.remove('d-none'));
        if (role === 'moderator') document.querySelectorAll('.role-owner,.role-mod').forEach(e => e.classList.remove('d-none'));
        if (role === 'admin') document.querySelectorAll('.role-owner,.role-mod,.role-admin').forEach(e => e.classList.remove('d-none'));
        document.querySelectorAll('[data-role-set]').forEach(b => b.classList.toggle('active', b.dataset.roleSet === role));
    }
    document.querySelectorAll('[data-role-set]').forEach(btn => btn.addEventListener('click', () => setRole(btn.dataset.roleSet)));
    applyRole(localStorage.getItem('demoRole') || 'guest');
    document.querySelectorAll('.like-btn').forEach(btn => btn.addEventListener('click', () => {
        btn.classList.toggle('btn-primary');
        btn.classList.toggle('btn-light')
    }));
})();