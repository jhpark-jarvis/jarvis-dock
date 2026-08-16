import { contextBridge, ipcRenderer } from 'electron';
import { createDockApi } from './dock-api';

contextBridge.exposeInMainWorld('dock', createDockApi(ipcRenderer));
