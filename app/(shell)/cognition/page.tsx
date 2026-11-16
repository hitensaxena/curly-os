import { redirect } from "next/navigation";

// The advanced cognition views (meta-cognition, reflection, attention) are a
// tab inside Think now; this route stays so old links land in the right place.
export default function Page() {
  redirect("/think#advanced");
}
