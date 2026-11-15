const clientToken = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      Pagamentos em modo de teste. Nenhuma cobrança real será feita.
    </div>
  );
}
