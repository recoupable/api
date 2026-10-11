import create from "./catalog/create.json";
import promote from "./catalog/promote.json";
import discover from "./catalog/discover.json";
import catalog from "./catalog/catalog.json";
import business from "./catalog/business.json";
export default [...create, ...promote, ...discover, ...catalog, ...business].sort(
  (a, b) => a.number - b.number,
);
