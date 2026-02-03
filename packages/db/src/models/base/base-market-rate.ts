/**
 * BaseMarketRate - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../MarketRate.ts to add custom methods
 */

import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

export abstract class BaseMarketRate extends Model {
  static table = "market_rates";

  @field("aed_egp") aedEgp!: number;
  @field("aud_egp") audEgp!: number;
  @field("bhd_egp") bhdEgp!: number;
  @field("btc_egp") btcEgp!: number;
  @field("cad_egp") cadEgp!: number;
  @field("chf_egp") chfEgp!: number;
  @field("cnh_egp") cnhEgp!: number;
  @field("cny_egp") cnyEgp!: number;
  @readonly @date("created_at") createdAt!: Date;
  @field("dkk_egp") dkkEgp!: number;
  @field("dzd_egp") dzdEgp!: number;
  @field("eur_egp") eurEgp!: number;
  @field("gbp_egp") gbpEgp!: number;
  @field("gold_egp_per_gram") goldEgpPerGram!: number;
  @field("hkd_egp") hkdEgp!: number;
  @field("inr_egp") inrEgp!: number;
  @field("iqd_egp") iqdEgp!: number;
  @field("isk_egp") iskEgp!: number;
  @field("jod_egp") jodEgp!: number;
  @field("jpy_egp") jpyEgp!: number;
  @field("kpw_egp") kpwEgp!: number;
  @field("krw_egp") krwEgp!: number;
  @field("kwd_egp") kwdEgp!: number;
  @field("lyd_egp") lydEgp!: number;
  @field("mad_egp") madEgp!: number;
  @field("myr_egp") myrEgp!: number;
  @field("nok_egp") nokEgp!: number;
  @field("nzd_egp") nzdEgp!: number;
  @field("omr_egp") omrEgp!: number;
  @field("palladium_egp_per_gram") palladiumEgpPerGram!: number;
  @field("platinum_egp_per_gram") platinumEgpPerGram!: number;
  @field("qar_egp") qarEgp!: number;
  @field("rub_egp") rubEgp!: number;
  @field("sar_egp") sarEgp!: number;
  @field("sek_egp") sekEgp!: number;
  @field("sgd_egp") sgdEgp!: number;
  @field("silver_egp_per_gram") silverEgpPerGram!: number;
  @field("timestamp_currency") timestampCurrency?: string;
  @field("timestamp_metal") timestampMetal?: string;
  @field("tnd_egp") tndEgp!: number;
  @field("try_egp") tryEgp!: number;
  @date("updated_at") updatedAt!: Date;
  @field("usd_egp") usdEgp!: number;
  @field("zar_egp") zarEgp!: number;
}
