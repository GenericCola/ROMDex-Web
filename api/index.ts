// Vercel Node Web handler. Static Next export remains in out/.
import { productionHandler } from "../server/application.ts";
export default { fetch: productionHandler };
