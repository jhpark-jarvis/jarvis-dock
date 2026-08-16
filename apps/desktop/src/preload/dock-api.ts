import {
  HealthResultSchema,
  internalError,
  IPC,
  type DockApi,
  type HealthResult,
  VersionResultSchema,
  type VersionResult,
} from '../shared/ipc';

export interface IpcInvoker {
  invoke: (channel: string, request: unknown) => Promise<unknown>;
}

const invokeHealth = async (ipcRenderer: IpcInvoker): Promise<HealthResult> => {
  const result = HealthResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.SYSTEM_HEALTH, {}),
  );

  return result.success ? result.data : { ok: false, error: internalError() };
};

const invokeVersion = async (
  ipcRenderer: IpcInvoker,
): Promise<VersionResult> => {
  const result = VersionResultSchema.safeParse(
    await ipcRenderer.invoke(IPC.SYSTEM_VERSION, {}),
  );

  return result.success ? result.data : { ok: false, error: internalError() };
};

export const createDockApi = (ipcRenderer: IpcInvoker): DockApi => ({
  system: {
    health: () => invokeHealth(ipcRenderer),
    version: () => invokeVersion(ipcRenderer),
  },
});
