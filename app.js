// Basic Mithril setup to verify everything works
const App = {
    view: function() {
        return m("h1", "Progress Log")
    }
}

// Simple component
const Hello = {
    view: () => m("h1", "Hello, Mithril!")
}

m.mount(document.getElementById("app"), App)
