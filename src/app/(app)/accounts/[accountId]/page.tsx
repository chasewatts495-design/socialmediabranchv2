export default async function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return (
    <div>
      <h1 className="text-xl font-semibold">Account {accountId}</h1>
      <p className="mt-2 text-sm text-muted">Detail page arrives in M4.</p>
    </div>
  );
}
