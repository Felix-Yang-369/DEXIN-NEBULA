export type ProductQualityInput = {
  image_path: string | null;
  barcode: string | null;
  customer_query_reply: string | null;
  out_of_stock_reply: string | null;
  order_guide_reply: string | null;
};

export type ProductQualityFlag =
  | "missing_image"
  | "missing_barcode"
  | "missing_price"
  | "incomplete_reply";

export function getProductQualityFlags(
  product: ProductQualityInput,
  hasPrice: boolean,
): ProductQualityFlag[] {
  const flags: ProductQualityFlag[] = [];
  if (!product.image_path) flags.push("missing_image");
  if (!product.barcode || product.barcode.includes("待")) {
    flags.push("missing_barcode");
  }
  if (!hasPrice) flags.push("missing_price");
  if (
    !product.customer_query_reply ||
    !product.out_of_stock_reply ||
    !product.order_guide_reply
  ) {
    flags.push("incomplete_reply");
  }
  return flags;
}
