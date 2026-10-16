import { supabase } from "@/app/supabase";
import type { BoqItem } from "@/app/parseBoq";

export type PricingResult = {
  item_code: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  template_code: string;
  template_name: string;
  status: "priced" | "unpriced" | "error";
  error?: string;
};

/**
 * تسعير بند واحد
 */
export async function priceSingleItem(item: BoqItem): Promise<PricingResult> {
  try {
    const { data: matchData, error: matchError } = await supabase.rpc(
      "resolve_breakdown_template",
      {
        p_item_code: item.item_code || "",
        p_desc: item.description || "",
        p_unit: item.unit || "",
      }
    );

    if (matchError || !matchData?.ok) {
      return {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: 0,
        total_price: 0,
        template_code: "",
        template_name: "",
        status: "unpriced",
        error: matchData?.error || matchError?.message || "no_template",
      };
    }

    const templateCode = matchData.template;

    const { data: defaultAns } = await supabase
      .from("template_default_answers")
      .select("answers")
      .eq("template_item_code", templateCode)
      .maybeSingle();

    const { data: priceData, error: priceError } = await supabase.rpc(
      "price_recipe_for_boq",
      {
        p_template: templateCode,
        p_desc: item.description || "",
        p_unit: item.unit || "",
        p_qty: item.quantity || 1,
        p_answers: defaultAns?.answers || {},
      }
    );

    if (priceError || !priceData?.ok) {
      return {
        item_code: item.item_code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: 0,
        total_price: 0,
        template_code: templateCode,
        template_name: matchData.name || "",
        status: "error",
        error: priceData?.error || priceError?.message || "pricing_failed",
      };
    }

    return {
      item_code: item.item_code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: priceData.unit_price || 0,
      total_price: priceData.total_price || 0,
      template_code: templateCode,
      template_name: priceData.name || matchData.name || "",
      status: "priced",
    };
  } catch (err: any) {
    return {
      item_code: item.item_code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: 0,
      total_price: 0,
      template_code: "",
      template_name: "",
      status: "error",
      error: err.message,
    };
  }
}