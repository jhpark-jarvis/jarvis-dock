import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  IPC,
  RuntimeRecordEventRequestSchema,
  type DockError,
} from '../shared/ipc';
import { RuntimeTelemetry } from './runtime-telemetry';

type IpcMainHandlerRegistrar = Pick<IpcMain, 'handle'>;

export interface RuntimeHandlerDependencies {
  ipcMain: IpcMainHandlerRegistrar;
  telemetry: RuntimeTelemetry;
  isTrustedSender: (senderUrl: string) => boolean;
}

const error = (code: DockError['code'], message: string): DockError => ({
  code,
  message,
});

export const registerRuntimeHandlers = ({
  ipcMain,
  telemetry,
  isTrustedSender,
}: RuntimeHandlerDependencies): void => {
  ipcMain.handle(
    IPC.RUNTIME_RECORD_EVENT,
    (event: IpcMainInvokeEvent, request) => {
      if (!isTrustedSender(event.senderFrame.url)) {
        return {
          ok: false,
          error: error(
            'UNAUTHORIZED_SENDER',
            'The Dock runtime request is not authorized.',
          ),
        };
      }
      const parsed = RuntimeRecordEventRequestSchema.safeParse(request);
      if (!parsed.success) {
        return {
          ok: false,
          error: error('INVALID_REQUEST', 'The Dock runtime event is invalid.'),
        };
      }
      telemetry.recordAction(parsed.data.event, parsed.data.details);
      return { ok: true, value: { recorded: true } };
    },
  );
};
