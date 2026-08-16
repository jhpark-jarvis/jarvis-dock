import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  EmptyRequestSchema,
  HealthResultSchema,
  IPC,
  type DockError,
  VersionResultSchema,
} from '../shared/ipc';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface SystemHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  getVersion: () => string;
  isTrustedSender: (senderUrl: string) => boolean;
}

const invalidRequestError = (): DockError => ({
  code: 'INVALID_REQUEST',
  message: 'The Dock system request is invalid.',
});

const unauthorizedSenderError = (): DockError => ({
  code: 'UNAUTHORIZED_SENDER',
  message: 'The Dock system request is not authorized.',
});

const getRequestError = (
  event: IpcMainInvokeEvent,
  request: unknown,
  isTrustedSender: (senderUrl: string) => boolean,
): DockError | undefined => {
  if (!isTrustedSender(event.senderFrame.url)) {
    return unauthorizedSenderError();
  }

  if (!EmptyRequestSchema.safeParse(request).success) {
    return invalidRequestError();
  }

  return undefined;
};

export const registerSystemHandlers = ({
  ipcMain,
  getVersion,
  isTrustedSender,
}: SystemHandlerDependencies): void => {
  ipcMain.handle(IPC.SYSTEM_HEALTH, (event, request) => {
    const error = getRequestError(event, request, isTrustedSender);

    if (error) {
      return { ok: false, error };
    }

    return HealthResultSchema.parse({
      ok: true,
      value: { status: 'ok' },
    });
  });

  ipcMain.handle(IPC.SYSTEM_VERSION, (event, request) => {
    const error = getRequestError(event, request, isTrustedSender);

    if (error) {
      return { ok: false, error };
    }

    return VersionResultSchema.parse({
      ok: true,
      value: { version: getVersion() },
    });
  });
};
