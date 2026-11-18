import { Redirect } from "expo-router";

/**
 * The app opens on the bare scheme URL (rokimu:///), and nothing lives at the
 * root path: without this, a fresh install lands on "Unmatched route".
 */
export default function Index() {
  return <Redirect href="/(tabs)/library" />;
}
