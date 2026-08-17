export async function findAuthUserByEmail(adminAuth, email, perPage = 1000) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await adminAuth.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return undefined;
    }

    page += 1;
  }
}
