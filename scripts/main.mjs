import { GroupLootApp } from "./loot-app.mjs";

const MODULE_ID = "group-loot";
const SETTING_KEY = "lootData";
const SOCKET_EVENT = "applyLootPatch";

let app;

//basic schema for item entry
function normalizeLoot(data) {
  // Old worlds may just have an array
  if (Array.isArray(data)) {
    return {
      items: data.map(x => ({
        id: String(x?.id ?? foundry.utils.randomID()),
        name: String(x?.name ?? "Unnamed"),
        qty: Number.isFinite(Number(x?.qty)) ? Number(x.qty) : 1,
        notes: String(x?.notes ?? "")
      })),
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 }
    };
  }

  return {
    items: Array.isArray(data?.items) ? data.items.map(x => ({
      id: String(x?.id ?? foundry.utils.randomID()),
      name: String(x?.name ?? "Unnamed"),
      qty: Number.isFinite(Number(x?.qty)) ? Number(x.qty) : 1,
      notes: String(x?.notes ?? "")
    })) : [],
    currency: {
      pp: Number(data?.currency?.pp ?? 0),
      gp: Number(data?.currency?.gp ?? 0),
      sp: Number(data?.currency?.sp ?? 0),
      cp: Number(data?.currency?.cp ?? 0)
    }
  };
}

function getLoot() {
    return normalizeLoot(game.settings.get(MODULE_ID, SETTING_KEY));
}

async function setLoot(next) {
    //only gm can call this one
    return game.settings.set(MODULE_ID, SETTING_KEY, normalizeLoot(next));
}

//apply a "patch" describing an operation
async function applyPatch(patch) {
    const loot = getLoot();
    console.log("GroupLoot | applyPatch start", patch, "current loot", loot);

    switch (patch?.op) {
        case "add": {
            loot.items.unshift({
                id: foundry.utils.randomID(),
                name: patch.name ?? "New Item",
                qty: Number.isFinite(Number(patch.qty)) ? Number(patch.qty) : 1,
                notes: patch.notes ?? ""
            });
            break;
        }

        case "update": {
            const i = loot.items.findIndex(x => x.id === patch.id);
            if(i >= 0) {
                if (patch.name != null) loot.items[i].name = String(patch.name);
                if (patch.qty != null) loot.items[i].qty = Number(patch.qty);
                if (patch.notes != null) loot.items[i].notes = String(patch.notes);
            }
            break;
        }

        case "delete": {
            const i = loot.items.findIndex(x => x.id === patch.id);
            if ( i >= 0) loot.items.splice(i, 1);
            break;
        }

        case "clear": {
            loot.items.length = 0;
            break;
        }

        case "currency": {
            const { denom, value } = patch;
            if (!["pp", "gp", "sp", "cp"].includes(denom)) return;
            loot.currency[denom] = Math.max(0, Number(value) || 0);
            break;
        }

        default:
            return;
    }

    console.log("GroupLoot | applyPatch setLoot", loot);
    await setLoot(loot);
    game.socket.emit(`module.${MODULE_ID}`, { event: "refreshUI" });
}

async function requestPatch(patch) {
    console.log("GroupLoot | requestPatch", patch, "isGM?", game.user.isGM);
    const hasGM = game.users?.some(u => u.active && u.isGM);
    // If THIS client is the GM, apply immediately.
    if (game.user.isGM) {
        await applyPatch(patch);
        console.log("GroupLoot | GM applied patch locally");
        game.socket.emit(`module.${MODULE_ID}`, { event: "refreshUI" });
        return;
    }
    
    if (!hasGM) {
        ui.notifications?.warn("No GM is currently connected to save changes.");
        return;
    }
    
    // Otherwise, ask GM to apply
    console.log("GroupLoot | emitting patch", patch);
    game.socket.emit(`module.${MODULE_ID}`, { event: SOCKET_EVENT, patch });
}

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, SETTING_KEY, {
        name: "Group Loot Data",
        scope: "world",
        config: false,
        type: Object,
        default: []
    });

    //GM listens for patch requests and commits them
    game.socket.on(`module.${MODULE_ID}`, async (payload) => {
        console.log("GroupLoot | socket recv", payload, "isGM?", game.user.isGM);

        if (payload?.event === "refreshUI") {
            if (app?.rendered) app.render({ force: true });
            return;
        }

        if (!game.user.isGM) return;
        if (payload?.event !== SOCKET_EVENT) return;

        try {
            await applyPatch(payload.patch);
            console.log("GroupLoot | patch applied + persisted");
            game.socket.emit(`module.${MODULE_ID}`, { event: "refreshUI" });
        } catch (err) {
            console.error(`${MODULE_ID} | Failed to apply patch`, err);
            ui.notifications?.error("Group Loot: update failed (see console).");
        }
    });
});

Hooks.once("ready", () => {
    console.log("GroupLoot | ready; isGM?", game.user.isGM);
    //create singleton app instance
    app = new GroupLootApp({
        moduleId: MODULE_ID,
        getLoot,
        requestPatch
    });
});

//re-render when the setting document updates.
//uses foundrys dynamic document hook pattern (update{DocumentName}). :contentReference[oaicite:4]{index=4}
Hooks.on("updateSetting", (settingDoc) => {
    if(!app) return;
    //key here
    const key = settingDoc?.key ?? settingDoc?.data?.key;
    if (key !== `${MODULE_ID}.${SETTING_KEY}`) return;

    // Only refresh if already open
    if (app.rendered) app.render({ force: true });
});

//add bag icon in top left via scene controls
Hooks.on("getSceneControlButtons", (controls) =>  {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    tokenControls.tools.groupLoot = {
        name: "groupLoot",
        title: "Group Loot",
        icon: "fa-solid fa-sack-dollar",
        button: true,
        order: 999,
        visible: true,
        onChange: () => {
            if(!app) return;
            app.render({ force: true});
        }
    };
});