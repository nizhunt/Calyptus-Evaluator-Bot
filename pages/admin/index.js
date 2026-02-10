import { requireAdminPageSession } from "../../lib/admin-auth";

export default function AdminIndex() {
  return null;
}

export async function getServerSideProps(context) {
  const { session } = requireAdminPageSession(context);

  return {
    redirect: {
      destination: session ? "/admin/evaluations" : "/admin/login",
      permanent: false,
    },
  };
}
