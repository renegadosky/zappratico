import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — ZapPrático" },
      {
        name: "description",
        content:
          "Política de Privacidade e Tratamento de Dados Pessoais da ZapPrático, em conformidade com a LGPD (Lei 13.709/2018).",
      },
      { property: "og:title", content: "Política de Privacidade — ZapPrático" },
      {
        property: "og:description",
        content: "Como tratamos seus dados na ZapPrático, conforme a LGPD.",
      },
      { property: "og:url", content: "https://zappratico.com.br/privacidade" },
    ],
    links: [{ rel: "canonical", href: "https://zappratico.com.br/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao início
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-display font-bold mb-2">
          Política de Privacidade e Proteção de Dados
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Versão 1.0 · Em conformidade com a Lei 13.709/2018 (LGPD) · Vigência: 25 de maio de 2026
        </p>

        <div className="space-y-8 text-foreground/90 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">1. Controlador dos dados</h2>
            <p>
              A ZapPrático ("Empresa", "nós") é a controladora dos dados pessoais coletados
              de seus Usuários (titulares de conta) e operadora dos dados pessoais de
              Clientes Finais tratados em nome dos Usuários, nos termos do art. 5º, VI e VII,
              da Lei Geral de Proteção de Dados (Lei 13.709/2018 — "LGPD").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">2. Dados que coletamos</h2>
            <p>Coletamos as seguintes categorias de dados:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Dados cadastrais:</strong> nome completo, e-mail, senha criptografada, telefone (opcional).</li>
              <li><strong>Dados de configuração:</strong> nome da loja, produtos, fluxos do bot, mensagens-modelo, chave PIX.</li>
              <li><strong>Dados financeiros:</strong> histórico de assinaturas. Os dados de cartão são processados diretamente pela <strong>Stripe Payments Inc.</strong> — não os armazenamos.</li>
              <li><strong>Dados de uso:</strong> logs de acesso (IP, data/hora, navegador), métricas de uso e diagnóstico.</li>
              <li><strong>Dados de Clientes Finais:</strong> número de WhatsApp, nome, conteúdo das mensagens e pedidos — tratados em nome do Usuário.</li>
              <li><strong>Cookies e similares:</strong> usados para autenticação, preferências e analytics agregado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">3. Bases legais e finalidades</h2>
            <p>O tratamento de dados ocorre com fundamento nas seguintes hipóteses do art. 7º da LGPD:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Execução de contrato (art. 7º, V):</strong> prestação do Serviço, cobrança, suporte.</li>
              <li><strong>Cumprimento de obrigação legal (art. 7º, II):</strong> guarda de logs de acesso por 6 meses (Marco Civil da Internet — Lei 12.965/2014, art. 15) e dados fiscais por 5 anos.</li>
              <li><strong>Legítimo interesse (art. 7º, IX):</strong> prevenção a fraudes, segurança e melhoria do produto.</li>
              <li><strong>Consentimento (art. 7º, I):</strong> envio de comunicações de marketing, quando aplicável, sempre revogável.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">4. Compartilhamento de dados</h2>
            <p>Não vendemos dados pessoais. Compartilhamos apenas com:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Operadores essenciais:</strong> provedores de hospedagem em nuvem (Cloudflare, Supabase), pagamento (Stripe), e-mail transacional e analytics — todos contratualmente obrigados a tratar os dados conforme a LGPD;</li>
              <li><strong>Autoridades públicas:</strong> quando exigido por ordem judicial, requisição legal ou para cumprir obrigação legal/regulatória;</li>
              <li><strong>Sucessores legais:</strong> em caso de fusão, aquisição ou reorganização societária, mediante notificação prévia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">5. Transferência internacional</h2>
            <p>
              Parte da infraestrutura pode estar localizada fora do Brasil (ex.: data centers
              nos Estados Unidos e União Europeia). As transferências observam os requisitos
              do art. 33 da LGPD, sendo realizadas para países com nível adequado de proteção
              ou mediante cláusulas contratuais específicas.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">6. Direitos do titular (art. 18 da LGPD)</h2>
            <p>Você tem direito a, a qualquer momento:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Confirmar a existência de tratamento;</li>
              <li>Acessar os dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a LGPD;</li>
              <li>Solicitar a portabilidade dos dados a outro fornecedor;</li>
              <li>Eliminar dados tratados com base no consentimento;</li>
              <li>Obter informações sobre entidades com as quais a Empresa compartilha dados;</li>
              <li>Revogar consentimento;</li>
              <li>Peticionar perante a Autoridade Nacional de Proteção de Dados (ANPD).</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, escreva para{" "}
              <a href="mailto:privacidade@zappratico.com" className="text-primary underline">
                privacidade@zappratico.com
              </a>. Responderemos em até 15 dias.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">7. Segurança da informação</h2>
            <p>
              Adotamos medidas técnicas e administrativas adequadas: criptografia em trânsito
              (TLS 1.2+), criptografia de senhas (bcrypt/argon2), controle de acesso baseado
              em função, segregação por <em>Row-Level Security</em> no banco, backups diários,
              registro de acessos e monitoramento contínuo. Apesar disso, nenhum sistema é
              100% seguro. Em caso de incidente que represente risco relevante aos titulares,
              comunicaremos a ANPD e os afetados nos prazos do art. 48 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">8. Retenção de dados</h2>
            <p>
              Mantemos os dados pelo tempo necessário às finalidades informadas e enquanto a
              conta estiver ativa. Após o cancelamento, os dados pessoais são eliminados em
              até 90 dias, ressalvados os casos em que a retenção é exigida por lei (ex.:
              logs de acesso por 6 meses, dados fiscais por 5 anos) ou para defesa em
              processos judiciais e administrativos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies estritamente necessários (sessão, autenticação), cookies de
              desempenho (analytics agregado e anônimo) e cookies funcionais. O Usuário pode
              gerenciar cookies pelas configurações do navegador; a desativação pode
              comprometer funcionalidades do Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">10. Crianças e adolescentes</h2>
            <p>
              O Serviço não é direcionado a menores de 18 anos. Não coletamos
              intencionalmente dados de menores. Caso identifiquemos tal coleta,
              procederemos à exclusão imediata.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">11. Encarregado pelo Tratamento de Dados (DPO)</h2>
            <p>
              Em conformidade com o art. 41 da LGPD, nosso Encarregado pode ser contatado em:
              <br />
              <strong>E-mail:</strong>{" "}
              <a href="mailto:privacidade@zappratico.com" className="text-primary underline">
                privacidade@zappratico.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">12. Alterações desta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. A data da última revisão é
              indicada no topo deste documento. Alterações materiais serão comunicadas por
              e-mail ou aviso na Plataforma com antecedência mínima de 15 dias.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
