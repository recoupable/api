import create from "./catalog/create.json";
import promote from "./catalog/promote.json";
import discover from "./catalog/discover.json";
import catalog from "./catalog/catalog.json";
export default [...create, ...promote, ...discover, ...catalog].sort((a, b) => a.number - b.number);
