import create from "./catalog/create.json";
import promote from "./catalog/promote.json";
import discover from "./catalog/discover.json";
import catalog from "./catalog/catalog.json";
import workspace from "./catalog/workspace.json";
export default [...create, ...promote, ...discover, ...catalog, ...workspace].sort(
  (a, b) => a.number - b.number,
);
