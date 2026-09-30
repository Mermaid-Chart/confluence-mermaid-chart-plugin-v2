"use strict";
class CPlugin {
  _sendMessage(data) {
    window.parent.postMessage(data, "*");
  }
  saveData(data) {
    // Image may be in diagramImage only (preferred). diagramCode kept for older collab clients.
    if (!data.documentID || !(data.diagramImage || data.diagramCode)) {
      throw new Error("Invalid saving diagram data");
    }
    this._sendMessage({
      action: "save",
      data,
    });
  }
  cancel() {
    this._sendMessage({
      action: "cancel",
    });
  }
  getData() {
    return window.name ? JSON.parse(window.name) : {};
  }
  invalidateToken() {
    this._sendMessage({
      action: "logout",
    });
  }
}

window.CP = new CPlugin();
