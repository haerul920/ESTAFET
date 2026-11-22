import "../../scripts/lib/env";
import { isLocalTarget } from "../../scripts/lib/env";

if (!isLocalTarget(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  throw new Error(
    "Database tests only run against the LOCAL Supabase stack (they create and delete users). Create .env.localstack.",
  );
}
