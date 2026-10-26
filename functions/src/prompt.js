// Shared by every provider: same instructions, same response contract.
// Both providers must answer with JSON matching RESPONSE_SCHEMA, which the
// client reads as { reply, designSpec? } (see src/services/aiClient.js).

export const SYSTEM_PROMPT = `Você é a MobílIA, uma designer de móveis planejados. Você ajuda pessoas a desenhar móveis sob medida em MDF que depois são fabricados com corte CNC pela Cortecloud.

Como conversar:
- Responda sempre em português do Brasil, com tom acolhedor, direto e profissional.
- O app é usado no celular: mensagens curtas, no máximo 3 perguntas por vez.
- Escreva texto simples, sem markdown (nada de **, #, tabelas). Listas curtas com "- " são aceitáveis.
- Se o assunto não for móveis ou o ambiente, redirecione com gentileza.

Como conduzir o projeto:
- Entenda o ambiente, a função do móvel, o estilo desejado e as medidas disponíveis (largura, altura e profundidade).
- Quando houver foto, comente o que você observa (estilo, cores, iluminação, obstáculos como tomadas e rodapés) e use isso nas sugestões. Nunca deduza medidas exatas pela foto: peça que a pessoa meça.
- Sugira materiais reais de chapa: MDF de 15 mm ou 18 mm (18 mm para estruturas e prateleiras longas), em padrões como Branco TX, Freijó, Carvalho, Louro Freijó, Preto ou Cinza. Fita de borda no mesmo padrão da chapa.
- Antes de finalizar, apresente um resumo da proposta (medidas, divisões, material) e peça confirmação.

Quando incluir designSpec:
- Inclua designSpec somente quando você já tiver as medidas e a pessoa tiver aprovado a proposta. Em qualquer outro momento, não inclua designSpec.
- O designSpec vira a lista de peças importada no Cortecloud, então precisa estar pronto para corte.
- Todas as medidas em milímetros (números inteiros).
- sheets: cada chapa usada, com um name único e descritivo (ex.: "MDF Freijó 18mm 2 faces", "HDF Branco 3mm 1 face"), o tipo, a espessura, a cor e quantas faces têm cor (1 ou 2). Fundos normalmente são HDF 3 mm ou 6 mm.
- edgeBands: cada fita usada, com um name único (ex.: "Fita Freijó 22x0,45mm"), cor, espessura (0,45 mm ou 1 mm) e largura (22 mm para chapas de 15/18 mm; 35 mm para chapas engrossadas).
- parts: todas as peças de corte (laterais, base, tampo, prateleiras, divisórias, fundo, portas, frentes e laterais de gaveta), com as dimensões de corte já descontando espessuras e folgas. Para cada peça:
  - lengthMm é a medida C (comprimento, no sentido do veio) e widthMm é a medida L (largura).
  - sheet é exatamente o name de uma chapa em sheets; edgeBand é exatamente o name de uma fita em edgeBands, ou "" se a peça não leva fita.
  - bandC1 e bandC2 indicam fita nas duas bordas do comprimento; bandL1 e bandL2 nas duas bordas da largura. Fita só nas bordas aparentes.
  - canRotate é true quando a peça pode girar no plano de corte (chapa lisa sem veio, ex.: branco ou fundo); false para padrões amadeirados.
  - notes descreve a usinagem/furação da peça (ex.: "furação para 2 dobradiças 35mm a 100mm das pontas"), ou "".
- components: ferragens e acessórios com categoria, descrição e quantidade (dobradiças, corrediças, puxadores, minifix, cavilhas, parafusos, pés etc.).
- environment é o ambiente do móvel (ex.: "Sala de estar").
- edgeBanding e drilling resumem em texto a fita e a furação do projeto.
- Na mesma resposta, use reply para resumir o projeto e avisar que é possível exportar a lista de peças para o Cortecloud pelo cartão do projeto.`;

export const SHEET_TYPES = ["Fibra", "Compensado", "HDF", "MDF", "MDF Premium", "MDP", "OSB", "Super MDF"];

export const COMPONENT_CATEGORIES = [
  "Parafuso de fixação de madeira",
  "Dispositivo de montagem",
  "Trilhos telescópicos",
  "Pé de mesa",
  "Trilhos de sustentação para porta de correr",
  "Suporte cabideiro",
  "Cavilhas",
  "Tubo cabideiro",
  "Dobradiças",
  "Perfis guia para porta de correr",
  "Buchas plásticas e nylon",
  "Perfil puxadores",
  "Cantoneiras para móveis",
  "Corrediças ocultas",
  "Pistões",
  "Porta objetos",
  "Cabideiros",
  "Sistema de porta de correr",
  "Pés para móveis",
  "Rodízios",
  "Acessórios plásticos",
];

const mm = (description) => ({ type: "integer", description });
const text = (description) => (description ? { type: "string", description } : { type: "string" });
const objectOf = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: {
    reply: {
      type: "string",
      description: "Mensagem para o usuário, em português do Brasil, sem markdown.",
    },
    designSpec: {
      ...objectOf({
        name: text("Nome curto do projeto, ex.: Painel Freijó 240"),
        summary: text("Uma ou duas frases descrevendo o móvel."),
        furnitureType: text("Ex.: painel de TV, guarda-roupa, estante"),
        environment: text("Ambiente onde o móvel fica, ex.: Sala de estar"),
        widthMm: mm("Largura total em mm"),
        heightMm: mm("Altura total em mm"),
        depthMm: mm("Profundidade total em mm"),
        material: text("Chapa principal, ex.: MDF Freijó"),
        thicknessMm: mm("Espessura da chapa principal em mm (15 ou 18)"),
        edgeBanding: text("Resumo da fita de borda"),
        drilling: text("Resumo da furação"),
        sheets: {
          type: "array",
          items: objectOf({
            name: text("Nome único usado em parts[].sheet"),
            type: { type: "string", enum: SHEET_TYPES },
            thicknessMm: mm("Espessura em mm"),
            color: text(),
            faces: { type: "integer", description: "Quantas faces têm cor (1 ou 2)" },
          }),
        },
        edgeBands: {
          type: "array",
          items: objectOf({
            name: text("Nome único usado em parts[].edgeBand"),
            color: text(),
            thicknessMm: { type: "number", description: "Espessura em mm, ex.: 0.45 ou 1" },
            widthMm: mm("Largura em mm, ex.: 22"),
          }),
        },
        parts: {
          type: "array",
          items: objectOf({
            name: text("Função da peça, ex.: Lateral esquerda"),
            quantity: { type: "integer" },
            lengthMm: mm("Medida C: comprimento de corte em mm, no sentido do veio"),
            widthMm: mm("Medida L: largura de corte em mm"),
            sheet: text("name de uma chapa em sheets"),
            edgeBand: text('name de uma fita em edgeBands, ou "" sem fita'),
            bandC1: { type: "boolean" },
            bandC2: { type: "boolean" },
            bandL1: { type: "boolean" },
            bandL2: { type: "boolean" },
            canRotate: { type: "boolean", description: "Pode girar no plano de corte (sem veio)" },
            notes: text('Usinagem/furação da peça, ou ""'),
          }),
        },
        components: {
          type: "array",
          items: objectOf({
            category: { type: "string", enum: COMPONENT_CATEGORIES },
            description: text(),
            quantity: { type: "integer" },
          }),
        },
      }),
      description: "Especificação final do móvel. Somente quando o usuário aprovou a proposta.",
    },
  },
};

/** Parses a provider's raw JSON text into { reply, designSpec }. Throws if unusable. */
export function parseModelOutput(text) {
  const data = JSON.parse(text);
  if (typeof data?.reply !== "string" || !data.reply.trim()) {
    throw new Error("Resposta sem campo reply");
  }
  const spec = data.designSpec;
  const validSpec =
    spec && typeof spec === "object" && typeof spec.name === "string" && typeof spec.summary === "string";
  return { reply: data.reply.trim(), designSpec: validSpec ? spec : null };
}

/** How an earlier assistant turn is replayed to a model: the same JSON it produced. */
export function assistantTurnText(message) {
  return JSON.stringify(
    message.designSpec ? { reply: message.text, designSpec: message.designSpec } : { reply: message.text }
  );
}
