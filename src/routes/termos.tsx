import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — ZapPrático" },
      {
        name: "description",
        content:
          "Termos e Condições Gerais de Uso da plataforma ZapPrático: regras contratuais, planos, responsabilidades e limitações.",
      },
      { property: "og:title", content: "Termos de Uso — ZapPrático" },
      {
        property: "og:description",
        content: "Regras contratuais de uso da plataforma ZapPrático.",
      },
      { property: "og:url", content: "https://zappratico.com.br/termos" },
    ],
    links: [{ rel: "canonical", href: "https://zappratico.com.br/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
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
          Termos e Condições Gerais de Uso
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Versão 1.0 · Vigência a partir de 25 de maio de 2026
        </p>

        <div className="space-y-8 text-foreground/90 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">1. Definições</h2>
            <p>Para os fins destes Termos, consideram-se:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Plataforma / Serviço:</strong> o software como serviço (SaaS) "ZapPrático", disponibilizado via web em <em>zappratico.com.br</em> e domínios associados.</li>
              <li><strong>ZapPrático:</strong> mantenedora da Plataforma, doravante denominada "Empresa".</li>
              <li><strong>Usuário:</strong> pessoa física ou jurídica que cria conta e utiliza o Serviço.</li>
              <li><strong>Cliente Final:</strong> destinatário das mensagens enviadas pelos bots configurados pelo Usuário.</li>
              <li><strong>Conteúdo do Usuário:</strong> textos, imagens, fluxos, produtos, mensagens e demais dados inseridos pelo Usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">2. Aceitação e capacidade</h2>
            <p>
              O cadastro na Plataforma implica aceitação integral e irrestrita destes Termos
              e da Política de Privacidade. O Usuário declara ter capacidade civil plena
              (maior de 18 anos ou pessoa jurídica regularmente constituída) e que as
              informações fornecidas são verdadeiras, completas e atualizadas.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">3. Objeto do Serviço</h2>
            <p>
              A ZapPrático disponibiliza ferramentas para criação, automação e gestão de
              chatbots de vendas operando sobre a infraestrutura do WhatsApp, incluindo
              construtor visual de fluxos, Assistente de Criação, templates, catálogo de produtos,
              integração com meio de pagamento PIX, mini-loja pública e relatórios.
              A Plataforma <strong>não é</strong> produto oficial do WhatsApp/Meta Platforms, Inc.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">4. Cadastro e conta</h2>
            <p>
              O Usuário é o único responsável pelas credenciais de acesso e por toda atividade
              realizada na sua conta. Em caso de uso não autorizado, deverá comunicar
              imediatamente a Empresa pelo e-mail{" "}
              <a href="mailto:suporte@zappratico.com" className="text-primary underline">
                suporte@zappratico.com
              </a>. A Empresa poderá recusar, suspender ou cancelar cadastros que apresentem
              dados falsos, inconsistentes ou em descumprimento destes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">5. Planos, pagamento e cancelamento</h2>
            <p>
              A Plataforma é oferecida exclusivamente por meio de planos pagos em assinatura mensal
              recorrente, processados pela <strong>Stripe Payments</strong>. Os valores e
              limites de cada plano são exibidos na página <Link to="/plans" className="text-primary underline">/plans</Link>.
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>A cobrança ocorre antecipadamente, no início de cada ciclo.</li>
              <li>O cancelamento pode ser solicitado a qualquer momento; o acesso permanece ativo até o término do ciclo já pago, sem reembolso proporcional, ressalvado o disposto no Código de Defesa do Consumidor (Lei 8.078/1990, art. 49 — direito de arrependimento em até 7 dias da primeira contratação).</li>
              <li>Em caso de inadimplência, o acesso aos recursos pagos poderá ser suspenso após 5 dias úteis do vencimento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">6. Uso permitido e proibido</h2>
            <p>O Usuário compromete-se a utilizar o Serviço em conformidade com a legislação brasileira, com a Política do WhatsApp Business e com estes Termos. É expressamente vedado:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Envio de mensagens não solicitadas (SPAM) ou em desacordo com a Lei do Marketing Direto e a LGPD;</li>
              <li>Comercialização de produtos ou serviços ilícitos, falsificados, perigosos ou de venda restrita sem autorização legal;</li>
              <li>Prática de fraudes, golpes, phishing ou engenharia social;</li>
              <li>Violação de direitos autorais, marcas, patentes ou direitos de personalidade;</li>
              <li>Tentativas de engenharia reversa, intrusão, sobrecarga ou comprometimento da Plataforma.</li>
            </ul>
            <p className="mt-2">
              A constatação de qualquer destas práticas autoriza a suspensão imediata da
              conta, sem aviso prévio e sem direito a reembolso, sem prejuízo das medidas
              judiciais cabíveis.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">7. Propriedade intelectual</h2>
            <p>
              Todos os direitos sobre o software, marca, logotipo, layout, código-fonte,
              documentação e demais elementos da Plataforma pertencem exclusivamente à
              Empresa, protegidos pela Lei 9.609/1998 (Software), Lei 9.610/1998 (Direitos
              Autorais) e Lei 9.279/1996 (Propriedade Industrial). O Conteúdo do Usuário
              permanece de sua propriedade, sendo concedida à Empresa licença não-exclusiva
              para hospedagem e operação do Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">8. Responsabilidade do Usuário</h2>
            <p>
              O Usuário é o único responsável pelo conteúdo das mensagens enviadas pelos seus
              bots, pelo cumprimento das obrigações comerciais, fiscais e consumeristas
              perante seus Clientes Finais, pela emissão de notas fiscais e pelo tratamento
              adequado de dados pessoais coletados, na condição de <strong>controlador</strong> nos termos da LGPD.
              A Empresa atua como <strong>operadora</strong>, processando dados conforme instruções do Usuário.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">9. Limitação de responsabilidade</h2>
            <p>
              Na máxima extensão permitida pela legislação, a Empresa não se responsabiliza por:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Bloqueio, suspensão ou banimento de números de WhatsApp por decisão da Meta Platforms;</li>
              <li>Indisponibilidade temporária decorrente de manutenção, força maior, falha de provedores terceiros ou ataques cibernéticos;</li>
              <li>Lucros cessantes, perda de oportunidade comercial ou danos indiretos;</li>
              <li>Conteúdo, exatidão ou consequências das mensagens automatizadas configuradas pelo Usuário ou geradas pela IA com base em seus comandos.</li>
            </ul>
            <p className="mt-2">
              A responsabilidade total da Empresa, em qualquer hipótese, limita-se ao valor
              efetivamente pago pelo Usuário nos 3 (três) meses anteriores ao evento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">10. Disponibilidade e SLA</h2>
            <p>
              A Empresa empreenderá esforços comercialmente razoáveis para manter o Serviço
              disponível em regime <em>24/7</em>, com meta de disponibilidade de 99,5% mensal,
              excluídas janelas de manutenção previamente comunicadas.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">11. Alterações destes Termos</h2>
            <p>
              A Empresa poderá modificar estes Termos a qualquer tempo. Alterações relevantes
              serão comunicadas com antecedência mínima de 15 dias por e-mail ou aviso dentro
              da Plataforma. O uso continuado após a vigência das alterações implica
              concordância tácita.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">12. Rescisão</h2>
            <p>
              Qualquer das partes poderá rescindir esta relação a qualquer momento. Em caso
              de descumprimento destes Termos, a rescisão pela Empresa será imediata. Os
              dados do Usuário serão mantidos por até 90 dias após a rescisão para fins de
              eventual reativação, e depois excluídos, ressalvadas as obrigações legais de
              guarda.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">13. Foro e legislação aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica
              eleito o foro da Comarca do domicílio do Usuário consumidor para dirimir
              quaisquer controvérsias, ou, nos demais casos, o foro da sede da Empresa, com
              renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-semibold mb-3">14. Contato</h2>
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:contato@zappratico.com" className="text-primary underline">
                contato@zappratico.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
