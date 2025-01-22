// Make sure marked is included
const marked = window.marked || require('marked');

// Configure marked once
marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    sanitize: false,
    smartLists: true,
    smartypants: true
});

// Helper function for date formatting 
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const dayNum = date.getDate().toString().padStart(2, '0');
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

// Data structure
const Store = {
    goals: [],
    selectedGoalId: null,

    load() {
        try {
            const saved = localStorage.getItem('goals')
            if (saved) {
                this.goals = JSON.parse(saved)
            }
        } catch (e) {
            console.error('Failed to load goals:', e)
            this.goals = []
        }
        console.log('Loaded goals:', this.goals)
    },

    save() {
        try {
            localStorage.setItem('goals', JSON.stringify(this.goals))
        } catch (e) {
            console.error('Failed to save goals:', e)
        }
    },

    addGoal(title, description = '') {
        if (!title || !title.trim()) return;

        this.goals.push({
            id: Date.now(),
            title: title.trim(),
            description: description.trim(),
            progress: [],
            isExpanded: false
        })
        this.save()
    },

    addProgress(goalId, text) {
        if (!text || !text.trim()) return;

        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            const newProgress = {
                id: Date.now(),
                date: new Date().toISOString(),
                text: text.trim()
            };
            goal.progress.unshift(newProgress);
            this.save();
            console.log('Progress added to goal:', goalId, 'text:', text);
        }
    },

    deleteGoal(goalId) {
        if (!goalId) return;
        this.goals = this.goals.filter(g => g.id !== goalId)
        this.selectedGoalId = null;
        this.save()
    },

    editGoal(goalId, title, description) {
        if (!goalId || !title || !title.trim()) return;

        const goal = this.goals.find(g => g.id === goalId)
        if (goal) {
            goal.title = title.trim()
            goal.description = description.trim()
            this.save()
        }
    },

    deleteProgress(goalId, progressId) {
        if (!goalId || !progressId) return;

        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            goal.progress = goal.progress.filter(p => p.id !== progressId);
            this.save();
            console.log('Progress deleted:', progressId, 'from goal:', goalId);
        }
    },

    toggleGoal(goalId) {
        if (this.selectedGoalId === goalId) {
            this.selectedGoalId = null;
        } else {
            this.selectedGoalId = goalId;
        }
        m.redraw();
    },

    export: function() {
        return JSON.stringify(this.goals);
    },

    import: function(data) {
        try {
            this.goals = JSON.parse(data);
            this.save();
            return true;
        } catch(e) {
            console.error('Import failed:', e);
            return false;
        }
    }
};

// Stream-based state management
const Stream = {
    create: function(initialValue) {
        let value = initialValue;
        const subscribers = [];

        const stream = function(newValue) {
            if (arguments.length > 0) {
                value = newValue;
                subscribers.forEach(fn => fn(value));
                m.redraw();
            }
            return value;
        };

        stream.map = function(fn) {
            const newStream = Stream.create();
            subscribers.push(val => newStream(fn(val)));
            return newStream;
        };

        return stream;
    }
};

const renderMarkdown = text => {
    if (!text) return '';
    return m.trust(marked.parse(text));
};

const Modal = {
    show: false,
    title: '',
    content: null,
    buttons: [],

    open(title, content, buttons) {
        if (!title || !content) return;

        Modal.show = true;
        Modal.title = title;
        Modal.content = content;
        Modal.buttons = buttons || [];
        m.redraw();
    },

    close() {
        Modal.show = false;
        Modal.title = '';
        Modal.content = null;
        Modal.buttons = [];
        m.redraw();
    },

    view() {
        if (!Modal.show) return null;

        return m(".modal-overlay", {
            onclick: (e) => {
                e.preventDefault();
                Modal.close();
            }
        }, [
            m(".modal-content", {
                onclick: (e) => e.stopPropagation()
            }, [
                m("h3.modal-title", Modal.title),
                Modal.content,
                m(".modal-footer", 
                    Modal.buttons.map(btn =>
                        m("button", {
                            class: btn.class || "button-default",
                            onclick: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (typeof btn.onclick === 'function') {
                                    btn.onclick();
                                }
                            }
                        }, btn.text)
                    )
                )
            ])
        ]);
    }
};

const GoalItem = {
    oninit(vnode) {
        this.progressText = Stream.create('');
    },

    view: function(vnode) {
        const goal = vnode.attrs.goal;
        if (!goal) return null;

        const isExpanded = goal.id === Store.selectedGoalId;

        return m(".goal", [
            m(".goal-header", [
                m("h2.goal-title", {
                    onclick: () => {
                        Store.toggleGoal(goal.id);
                    }
                }, m(".markdown", renderMarkdown(goal.title))),
                m(".goal-actions", [
                    m("button.add-progress", {
                        onclick: (e) => {
                            e.stopPropagation();
                            this.progressText('');
                            Modal.open("Add Progress", 
                                m(".modal-body", [
                                    m("textarea.progress-textarea", {
                                        placeholder: "Enter progress...",
                                        value: this.progressText(),
                                        oninput: (e) => this.progressText(e.target.value),
                                        autofocus: true
                                    })
                                ]),
                                [
                                    {
                                        text: "Add",
                                        class: "button-primary",
                                        onclick: () => {
                                            const text = this.progressText();
                                            if (text && text.trim()) {
                                                Store.addProgress(goal.id, text);
                                                this.progressText('');
                                                Modal.close();
                                                m.redraw();
                                            }
                                        }
                                    },
                                    {
                                        text: "Cancel",
                                        onclick: () => {
                                            this.progressText('');
                                            Modal.close();
                                        }
                                    }
                                ]
                            );
                        }
                    }, "+"),
                    m("button.menu-button", {
                        onclick: (e) => {
                            e.stopPropagation();
                            const editState = {
                                title: goal.title,
                                description: goal.description
                            };

                            Modal.open("Edit Goal", 
                                m(".edit-form", [
                                    m(".form-group", [
                                        m("label", "Title"),
                                        m("input[type=text]", {
                                            value: editState.title,
                                            oninput: (e) => editState.title = e.target.value,
                                            autofocus: true
                                        })
                                    ]),
                                    m(".form-group", [
                                        m("label", "Description"),
                                        m("textarea", {
                                            value: editState.description,
                                            oninput: (e) => editState.description = e.target.value
                                        })
                                    ])
                                ]),
                                [
                                    {
                                        text: "Save",
                                        class: "button-primary",
                                        onclick: () => {
                                            if (editState.title.trim()) {
                                                Store.editGoal(goal.id, editState.title, editState.description);
                                                Modal.close();
                                                m.redraw();
                                            }
                                        }
                                    },
                                    {
                                        text: "Delete",
                                        class: "button-danger",
                                        onclick: () => {
                                            Modal.close();
                                            setTimeout(() => {
                                                Modal.open("Delete Goal",
                                                    m("p", "Are you sure you want to delete this goal?"),
                                                    [
                                                        {
                                                            text: "Delete",
                                                            class: "button-danger",
                                                            onclick: () => {
                                                                Store.deleteGoal(goal.id);
                                                                Modal.close();
                                                                m.redraw();
                                                            }
                                                        },
                                                        {
                                                            text: "Cancel",
                                                            onclick: () => Modal.close()
                                                        }
                                                    ]
                                                );
                                            }, 100);
                                        }
                                    },
                                    {
                                        text: "Cancel",
                                        onclick: () => Modal.close()
                                    }
                                ]
                            );
                        }
                    }, "⋮")
                ])
            ]),
            isExpanded && goal.description && m(".goal-description.markdown", 
                renderMarkdown(goal.description)
            ),
            isExpanded && m(".progress-list",
                goal.progress.map(entry =>
                    m(".progress-entry", {
                        key: entry.id
                    }, [
                        m(".progress-header", [
                            m(".progress-date", formatDate(entry.date)),
                            m("button.delete-progress", {
                                onclick: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    Modal.open("Delete Progress", 
                                        m(".modal-body", "Delete this progress entry?"),
                                        [
                                            {
                                                text: "Delete",
                                                class: "button-danger",
                                                onclick: () => {
                                                    Store.deleteProgress(goal.id, entry.id);
                                                    Modal.close();
                                                    m.redraw();
                                                }
                                            },
                                            {
                                                text: "Cancel",
                                                onclick: () => Modal.close()
                                            }
                                        ]
                                    );
                                }
                            }, "×")
                        ]),
                        m(".progress-text.markdown", renderMarkdown(entry.text))
                    ])
                )
            )
        ]);
    }
};

// App component
const App = {
    oninit: function() {
        Store.load()
    },

    view: function() {
        return m(".app", [
            m(".top-links", [
                m("span.links-container", [
                    m("a.subtle-link", {
                        href: "#",
                        onclick: (e) => {
                            e.preventDefault();
                            const data = Store.export();
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `goals-backup-${new Date().toISOString().split('T')[0]}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }
                    }, "Backup"),
                    m("span.separator", " | "),
                    m("label.subtle-link", {
                        onclick: (e) => e.target.querySelector('input').click()
                    }, [
                        "Import",
                        m("input[type=file][accept=.json]", {
                            style: "display: none",
                            onchange: (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    try {
                                        if (Store.import(e.target.result)) {
                                            m.redraw();
                                        } else {
                                            Modal.open("Import Error", 
                                                m("p", "Failed to import data. Please check the file format."),
                                                [{ text: "OK", onclick: () => Modal.close() }]
                                            );
                                        }
                                    } catch(err) {
                                        console.error('Import error:', err);
                                    }
                                };
                                reader.readAsText(file);
                            }
                        })
                    ]),
                    m("span.separator", " | "),
                    m("a.subtle-link", {
                        href: "https://github.com/jondoran/progresslog",
                        target: "_blank",
                        rel: "noopener noreferrer"
                    }, "About")
                ])
            ]),
            m("h1", "Progress Log"),
            m(".goals-list", 
                Store.goals.map(goal => 
                    m(GoalItem, {key: goal.id, goal: goal})
                )
            ),
            m("button.add-goal", {
                onclick: () => {
                    const newGoal = {
                        title: '',
                        description: ''
                    };
            
                    Modal.open("Add New Goal", 
                        m(".edit-form", [
                            m(".form-group", [
                                m("label", "Title"),
                                m("input[type=text]", {
                                    value: newGoal.title,
                                    oninput: (e) => newGoal.title = e.target.value,
                                    autofocus: true
                                })
                            ]),
                            m(".form-group", [
                                m("label", "Description"),
                                m("textarea", {
                                    value: newGoal.description,
                                    oninput: (e) => newGoal.description = e.target.value
                                })
                            ])
                        ]),
                        [
                            {
                                text: "Add",
                                class: "button-primary",
                                onclick: () => {
                                    if (newGoal.title.trim()) {
                                        Store.addGoal(newGoal.title, newGoal.description);
                                        Modal.close();
                                        m.redraw();
                                    }
                                }
                            },
                            {
                                text: "Cancel",
                                onclick: () => Modal.close()
                            }
                        ]
                    );
                }
            }, "Add New Goal"),            
            m(Modal)
        ])
    }
};

// Initialize the app
console.log('App starting...')
m.mount(document.getElementById("app"), App)
