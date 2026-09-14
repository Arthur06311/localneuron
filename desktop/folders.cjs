function registerFolderPicker({ ipcMain, dialog, getWindow, origin }) {
  ipcMain.handle("colmeia:choose-folder", async (event) => {
    const window = getWindow();
    if (
      !window ||
      event.senderFrame !== window.webContents.mainFrame ||
      new URL(event.senderFrame.url).origin !== origin
    )
      throw new Error("Origem recusada");
    const selected = await dialog.showOpenDialog(window, {
      title: "Pasta de trabalho da sua IA",
      properties: ["openDirectory"],
    });
    return selected.canceled ? null : selected.filePaths[0];
  });
}
module.exports = { registerFolderPicker };
