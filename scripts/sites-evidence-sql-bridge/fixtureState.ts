export const state = {
  calls: [] as { name: string; args: Record<string, unknown> }[],
  errors: [] as string[],
  denyWorkspace: false,
  beforePublish: undefined as undefined | (() => void),
  afterPublish: "",
};
