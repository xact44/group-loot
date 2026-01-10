const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GroupLootApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ moduleId, getLoot, requestPatch } = {}) {
    super();
    this.moduleId = moduleId;
    this.getLoot = getLoot;
    this.requestPatch = requestPatch;

    this._resizeObserver = null;
    this._resizeSaveTimer = null;
    this._restoredSizeOnce = false;
    this._suppressNextSave = false;
  }

  static get DEFAULT_OPTIONS() {
    return {
      id: "group-loot-app",
      window: { title: "Group Loot", resizable: true },
      position: { width: 600, height: 720 },
      classes: ["group-loot"],
      actions: {
        addItem: GroupLootApp.addItem,
        clearAll: GroupLootApp.clearAll,
        deleteItem: GroupLootApp.deleteItem
      }
    };
  }

  //#region Window Resizing
  //after render restore saved size once and start observing resizes
  async _render(options) {
    await super._render(options);

    //element becomes available after render
    if(!this._restoreSizeOnce) {
      this._restoreSizeOnce = true;
      this._restoreWindowSize();
    }

    this._ensureResizeObserver();
  }

  _restoreWindowSize() {
    const saved = game.settings.get(this.moduleId, "windowState");
    const width = Number(saved?.width);
    const height = Number(saved?.height);

    //make sure numbers are legit
    if(!Number.isFinite(width) || !Number.isFinite(height)) return;

    //prevent saving immediately from setPosition
    this._suppressNextSave = true;
    this.setPosition({width, height});
  }

  _ensureResizeObserver() {
    if(this._resizeObserver) return;
    if(!this.element) return;

    //observe the outer application element for size changes
    this._resizeObserver = new ResizeObserver(() => {
      //debounce saves so dragging resize handler doesnt blow up settings
      window.clearTimeout(this._resizeSaveTimer);
      this._resizeSaveTimer = window.setTimeout(() => this._saveWindowSize(), 250);
    });

    this._resizeObserver.observe(this.element);
  }

  _saveWindowSize() {
    if(!this.element) return;

    //skip first observer callback that might happen right after restore
    if(this._suppressNextSave) {
      this._suppressNextSave = false;
      return;
    }

    const rect = this.element.getBoundingClientRect();

    //round to ints
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    //maybe remove this. clamp to reasonable bounds
    const clamped = {
      width: Math.max(420, Math.min(1200, width)),
      height: Math.max(360, Math.min(1000, height))
    };

    game.settings.set(this.moduleId, "windowState", clamped);

  }

  //clean up the observer on close
  async close(options = {}) {
    window.clearTimeout(this._resizeSaveTimer);

    if(this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    return super.close(options);
  }

//#endregion

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