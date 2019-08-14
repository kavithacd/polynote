// BREAKOUT (notebooks_list.js)
import {UIEvent, UIEventTarget} from "../util/ui_event";
import {div, h2, iconButton, span, tag} from "../util/tags";
import {storage} from "../util/storage";

export class NotebookListUI extends UIEventTarget {
    constructor() {
        super();
        this.el = div(
            ['notebooks-list', 'ui-panel'], [
                h2([], [
                    'Notebooks',
                    span(['buttons'], [
                        iconButton(['import-notebook'], 'Import a notebook', '', 'Import').click(evt => {
                            evt.stopPropagation();
                            this.dispatchEvent(new UIEvent('ImportNotebook'));
                        }),
                        iconButton(['create-notebook'], 'Create new notebook', '', 'New').click(evt => {
                            evt.stopPropagation();
                            this.dispatchEvent(new UIEvent('NewNotebook'));
                        })
                    ])
                ]).click(evt => this.collapse()),
                div(['ui-panel-content'], [
                    this.treeView = div(['tree-view'], [])
                ])
            ]
        );

        // Drag n' drop!
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            this.el.addEventListener(evt, this.fileHandler.bind(this), false)
        });
    }

    setDisabled(disable) {
        if (disable) {
            [...this.el.querySelectorAll('.buttons button')].forEach(button => button.disabled = true);
        } else {
            [...this.el.querySelectorAll('.buttons button')].forEach(button => button.disabled = false);
        }
    }

    // Check storage to see whether this should be collapsed. Sends events, so must be called AFTER the element is created.
    init() {
        const prefs = this.getPrefs();
        if (prefs && prefs.collapsed) {
            this.collapse(true);
        }
    }

    getPrefs() {
        return storage.get("NotebookListUI")
    }

    setPrefs(obj) {
        storage.set("NotebookListUI", {...this.getPrefs(), ...obj})
    }

    setItems(items) {
        if (this.tree) {
            // remove current items
            this.treeView.innerHTML = '';
        }

        const tree = NotebookListUI.parseItems(items);

        const [itemTree, treeEl] = this.buildTree(tree, [], tag('ul', [], {}, []));
        this.tree = itemTree;
        this.treeEl = treeEl;
        this.treeView.appendChild(treeEl);
    }

    static parseItems(items) {
        const tree = {};

        for (const item of items) {
            const itemPath = item.split(/\//g);
            let currentTree = tree;

            while (itemPath.length > 1) {
                const pathSegment = itemPath.shift();
                if (!currentTree[pathSegment]) {
                    currentTree[pathSegment] = {};
                }
                currentTree = currentTree[pathSegment];
            }

            currentTree[itemPath[0]] = item;
        }
        return tree;
    }

    buildTree(treeObj, path, listEl) {

        const resultTree = {};

        for (const itemName in treeObj) {
            if (treeObj.hasOwnProperty(itemName)) {
                const item = treeObj[itemName];
                let itemEl = null;
                if (typeof item === "string") {
                    // leaf - item is the complete path
                    itemEl = tag('li', ['leaf'], {}, [
                        span(['name'], [itemName]).click(evt => {
                            this.dispatchEvent(new UIEvent('TriggerItem', {item: item}));
                        })
                    ]);
                    itemEl.item = item;
                    resultTree[itemName] = itemEl;
                    listEl.appendChild(itemEl);
                } else {
                    const itemPath = [...path, itemName];
                    const pathStr = itemPath.join('/');
                    let subListEl = null;
                    for (const child of listEl.children) {
                        if (child.pathStr && child.pathStr === pathStr) {
                            subListEl = child.listEl;
                            itemEl = child;
                            break;
                        }
                    }

                    if (subListEl === null) {
                        subListEl = tag('ul', [], {}, []);
                        itemEl = tag('li', ['branch'], {}, [
                            span(['branch-outer'], [
                                span(['expander'], []).click(evt => this.toggle(itemEl)),
                                span(['icon'], []),
                                span(['name'], [itemName])
                            ]),
                            subListEl
                        ]);
                        itemEl.path = itemPath;

                        listEl.appendChild(itemEl);

                        itemEl.appendChild(subListEl);
                        itemEl.listEl = subListEl;
                        itemEl.pathStr = pathStr;
                        listEl.appendChild(itemEl);
                    }

                    const [itemTree, itemList] = this.buildTree(item, itemPath, subListEl);
                    resultTree[itemName] = itemTree;
                }
            }
        }
        return [resultTree, listEl];
    }

    addItem(path) {
        this.buildTree(NotebookListUI.parseItems([path]), [], this.treeEl);
    }

    toggle(el) {
        if (!el) return;
        el.classList.toggle('expanded');
    }

    collapse(force) {
        const prefs = this.getPrefs();
        if (force) {
            this.dispatchEvent(new UIEvent('ToggleNotebookListUI', {force: true}))
        } else if (prefs && prefs.collapsed) {
            this.setPrefs({collapsed: false});
            this.dispatchEvent(new UIEvent('ToggleNotebookListUI'))
        } else {
            this.setPrefs({collapsed: true});
            this.dispatchEvent(new UIEvent('ToggleNotebookListUI'))
        }
    }

    fileHandler(evt) {
        // prevent browser from displaying the ipynb file.
        evt.stopPropagation();
        evt.preventDefault();

        // handle highlighting
        if (evt.type === "dragenter" || evt.type === "dragover") {
            this.dragEnter = evt.target;
            this.el.classList.add('highlight');
        } else if (evt.type === "drop" || (evt.type === "dragleave" && evt.target === this.dragEnter)) {
            this.el.classList.remove('highlight');
        }

        // actually handle the file
        if (evt.type === "drop") {
            const xfer = evt.dataTransfer;
            const files = xfer.files;
            [...files].forEach((file) => {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onloadend = () => {
                    this.dispatchEvent(new UIEvent('ImportNotebook', {name: file.name, content: reader.result}))
                }
            })
        }
    }
}