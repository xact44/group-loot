const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GroupLootItemDetailsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor({parentApp, itemId} = {}) {
        super({ id: `group-loot-item-details-${itemId}` });
        this.parentApp = parentApp;
        this.itemId = itemId;
    }

    static DEFAULT_OPTIONS = {
        id: "group-loot-item-details",
        window: {title: "Loot Details", resizable: true},
        position: {width: 430, height: 390},
        classes: ["group-loot", "group-loot-details"]
    };

    static PARTS = {
        content: {template: "modules/group-loot/templates/loot-item-details.hbs"}
    };

    async _prepareContext() {
        const data = this.parentApp.getLoot();
        const item = data.items.find(x => x.id === this.itemId);

        return {item: item, isGM: game.user.isGM};
    }

    _attachPartListeners(partId, htmlElement, _options) {
        super._attachPartListeners(partId, htmlElement, _options);
        if(partId !== "content") return;

        //listen to changes in the form fields and patch updates
        htmlElement.querySelectorAll("[data-extra]").forEach(el => {
            el.addEventListener("click", ev => ev.stopPropagation());
            el.addEventListener("change", (ev) => {
                ev.stopPropagation();

                const target = ev.currentTarget;
                const field = target.dataset.extra;

                const value = target.type === "checkbox" ? target.checked : target.value;
                
                this.parentApp.requestPatch({
                    op: "updateExtra",
                    id: this.itemId,
                    field,
                    value
                });
            });
        });
    }
}