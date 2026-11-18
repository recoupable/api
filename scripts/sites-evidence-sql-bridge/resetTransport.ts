import { state } from "./fixtureState";
export function resetTransport() {
  state.calls = [];
  state.errors = [];
  state.denyWorkspace = false;
  state.beforePublish = undefined;
  state.afterPublish = "";
}
