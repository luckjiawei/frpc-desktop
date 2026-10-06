module.exports = async context => {
  if (context.electronPlatformName === "win32") {
    const { prepareWindowsService } = await import("./prepare-windows-service.mjs");
    await prepareWindowsService();
  }
};
