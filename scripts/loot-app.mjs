const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GroupLootApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ moduleId, getLoot, requestPatch } = {}) {
    super();
    this.moduleId = moduleId;
    this.getLoot = getLoot;
    this.requestPatch = requestPatch;
  }

  static get DEFAULT_OPTIONS() {
    return {
      id: "group-loot-app",
      window: { title: "Group Loot" },
      position: { width: 520, height: 560 },
      classes: ["group-loot"],
      actions: {
        addItem: GroupLootApp.addItem,
        clearAll: GroupLootApp.clearAll,
        deleteItem: GroupLootApp.deleteItem
      }
    };
  }

  // Actions MUST be static; Foundry binds `this` to the app instance when calling them.
  static addItem(_event, _target) {
    console.log("ADD CLICKED");
    this.requestPatch({ op: "add", name: "New Item", qty: 1, notes: "" });
  }

  static clearAll(_event, _target) {
    if (!game.user.isGM) {
      ui.notifications?.warn("Only the GM can clear everything.");
     return;
    }
    this.requestPatch({ op: "clear" });
  }

  static deleteItem(_event, target) {
    const id = target?.dataset?.id;
    if (!id) return;
    this.requestPatch({ op: "delete", id });
  }

  static PARTS = {
    content: {
      template: "modules/group-loot/templates/loot-app.hbs"
    }
  };

  /** Provide template context */
  async _prepareContext() {
    const data = this.getLoot();
    return {
      isGM: game.user.isGM,
      loot: data.items,
      currency: data.currency
    };
  }

  /** Attach non-click listeners (inputs) */
  _attachPartListeners(partId, htmlElement, _options) {
    super._attachPartListeners(partId, htmlElement, _options);
    if (partId !== "content") return;

    // v13: htmlElement is a plain DOM element, not jQuery. :contentReference[oaicite:7]{index=7}
    htmlElement.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("change", (ev) => {
        const target = ev.currentTarget;
        const id = target.dataset.id;
        const field = target.dataset.field;
        if (!id || !field) return;

        let value = target.value;
        if (field === "qty") value = Number(value);

        this.requestPatch({ op: "update", id, [field]: value });
      });
    });

    htmlElement.querySelectorAll(".gl-currency input").forEach(el => {
      el.addEventListener("change", ev => {
        const denom = ev.currentTarget.dataset.denom;
        const value = Number(ev.currentTarget.value);
        this.requestPatch({ op: "currency", denom, value });
      });
    });
  }
}