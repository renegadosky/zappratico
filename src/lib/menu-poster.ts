// Renderiza a imagem do cardápio direto no Canvas 2D.
// Não depende de html-to-image / CSS moderno (oklch, lab) nem de fontes externas,
// por isso funciona sempre — mesmo com a aba "Visual" fechada.

export interface PosterTheme {
  primary: string;
  background: string;
  text: string;
  accent: string;
}

export interface PosterLine {
  name: string;
  priceCents: number;
  note?: string | null;
}

export interface PosterInput {
  title: string;
  subtitle?: string | null;
  lines: PosterLine[];
  theme: PosterTheme;
  logoUrl?: string | null;
  headerImageUrl?: string | null;
  template?: string | null;
}

const W = 1080;

function money(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const ok = await new Promise<boolean>((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = url;
      setTimeout(() => res(false), 5000);
    });
    return ok && img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderMenuPoster(input: PosterInput): Promise<Blob> {
  const { theme } = input;
  const headerImg = input.headerImageUrl ? await loadImage(input.headerImageUrl) : null;
  const logoImg = input.logoUrl ? await loadImage(input.logoUrl) : null;

  const padX = 72;
  const rowH = 78;
  const headerH = 300 + (logoImg ? 40 : 0);
  const bannerH = headerImg ? 320 : 0;
  const listH = Math.max(rowH, input.lines.length * rowH) + 80;
  const footerH = 110;
  const H = headerH + bannerH + listH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível neste navegador");

  // fundo
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, W, H);

  // header
  const solidHeader = (input.template ?? "restaurant") === "restaurant";
  if (solidHeader) {
    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, 0, W, headerH);
  }
  const headTextColor = solidHeader ? "#ffffff" : theme.primary;
  const headSubColor = solidHeader ? "rgba(255,255,255,0.85)" : theme.text;

  let y = 96;
  if (logoImg) {
    const s = 96;
    ctx.save();
    ctx.beginPath();
    ctx.arc(padX + s / 2, y + s / 2 - 20, s / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, padX, y - 20, s, s);
    ctx.restore();
    y += s + 16;
  }

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = solidHeader ? "rgba(255,255,255,0.8)" : theme.accent;
  ctx.font = "600 26px Georgia, 'Times New Roman', serif";
  ctx.fillText("C A R D Á P I O", padX, y);

  y += 78;
  ctx.fillStyle = headTextColor;
  ctx.font = "bold 76px Georgia, 'Times New Roman', serif";
  const title = input.title.length > 24 ? input.title.slice(0, 23) + "…" : input.title;
  ctx.fillText(title, padX, y);

  if (input.subtitle) {
    y += 50;
    ctx.fillStyle = headSubColor;
    ctx.font = "34px Georgia, 'Times New Roman', serif";
    ctx.fillText(input.subtitle.slice(0, 60), padX, y);
  }

  // banner
  let cursor = headerH;
  if (headerImg) {
    const ratio = Math.max(W / headerImg.naturalWidth, bannerH / headerImg.naturalHeight);
    const dw = headerImg.naturalWidth * ratio;
    const dh = headerImg.naturalHeight * ratio;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, cursor, W, bannerH);
    ctx.clip();
    ctx.drawImage(headerImg, (W - dw) / 2, cursor + (bannerH - dh) / 2, dw, dh);
    ctx.restore();
    cursor += bannerH;
  }

  // itens
  cursor += 56;
  if (input.lines.length === 0) {
    ctx.fillStyle = theme.text;
    ctx.globalAlpha = 0.6;
    ctx.font = "34px Georgia, serif";
    ctx.fillText("Nenhum item neste cardápio", padX, cursor + 20);
    ctx.globalAlpha = 1;
  }

  for (const line of input.lines) {
    ctx.font = "bold 38px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = theme.primary;
    const name = line.name.length > 30 ? line.name.slice(0, 29) + "…" : line.name;
    ctx.fillText(name, padX, cursor);
    const nameW = ctx.measureText(name).width;

    ctx.font = "bold 38px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = theme.accent;
    const price = money(line.priceCents);
    const priceW = ctx.measureText(price).width;
    ctx.fillText(price, W - padX - priceW, cursor);

    // pontilhado
    const dotStart = padX + nameW + 16;
    const dotEnd = W - padX - priceW - 16;
    if (dotEnd > dotStart) {
      ctx.save();
      ctx.strokeStyle = theme.text;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(dotStart, cursor - 10);
      ctx.lineTo(dotEnd, cursor - 10);
      ctx.stroke();
      ctx.restore();
    }

    if (line.note) {
      ctx.font = "italic 26px Georgia, serif";
      ctx.fillStyle = theme.text;
      ctx.globalAlpha = 0.7;
      ctx.fillText(line.note.slice(0, 60), padX, cursor + 30);
      ctx.globalAlpha = 1;
    }

    cursor += rowH;
  }

  // footer
  ctx.fillStyle = theme.accent;
  roundRect(ctx, 0, H - footerH, W, footerH, 0);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 30px Georgia, serif";
  const foot = "B O M   A P E T I T E";
  const fw = ctx.measureText(foot).width;
  ctx.fillText(foot, (W - fw) / 2, H - footerH / 2 + 10);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png", 0.95));
  if (!blob) throw new Error("Não foi possível gerar a imagem do cardápio");
  return blob;
}
