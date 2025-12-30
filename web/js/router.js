/**
 * Client-Side Router
 * Handles navigation between views without page reloads
 */

class Router {
    constructor() {
        this.routes = {};
        this.currentView = null;
        this.isNavigating = false;
    }

    /**
     * Register a route
     */
    register(path, viewClass) {
        this.routes[path] = viewClass;
    }

    /**
     * Navigate to a route
     */
    async navigate(path, params = {}) {
        if (this.isNavigating) {
            console.warn('⏳ Navigation already in progress');
            return;
        }

        console.log('🧭 Navigating to:', path, 'with params:', params);

        const ViewClass = this.routes[path];
        
        if (!ViewClass) {
            console.error('❌ Route not found:', path);
            this.navigate('/');
            return;
        }

        this.isNavigating = true;

        try {
            // Cleanup current view
            if (this.currentView && typeof this.currentView.cleanup === 'function') {
                await this.currentView.cleanup();
            }

            // Create new view
            const view = new ViewClass();
            this.currentView = view;

            // Render view
            const appContainer = document.getElementById('app');
            appContainer.innerHTML = '';
            
            await view.render(appContainer, params);

            // Build URL with params
            let url = `#${path}`;
            if (Object.keys(params).length > 0) {
                const paramString = Object.entries(params)
                    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    .join('&');
                url += `?${paramString}`;
            }

            // Update URL without reload
            window.history.pushState({ path, params }, '', url);

        } catch (error) {
            console.error('❌ Navigation error:', error);
            this.navigate('/');
        } finally {
            this.isNavigating = false;
        }
    }

    /**
     * Get current route from URL hash
     */
    getCurrentRoute() {
        const hash = window.location.hash.slice(1) || '/';
        return hash.split('?')[0];
    }

    /**
     * Parse URL parameters
     */
    getParams() {
        const hash = window.location.hash.slice(1);
        const paramString = hash.split('?')[1];
        
        if (!paramString) return {};
        
        const params = {};
        paramString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        });
        
        return params;
    }

    /**
     * Initialize router
     */
    init() {
        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            if (event.state) {
                this.navigate(event.state.path, event.state.params);
            }
        });

        // Handle initial load
        const currentRoute = this.getCurrentRoute();
        const params = this.getParams();
        this.navigate(currentRoute, params);
    }

    /**
     * Redirect helper
     */
    redirect(path, params = {}) {
        this.navigate(path, params);
    }
}

// Create global router instance
window.router = new Router();