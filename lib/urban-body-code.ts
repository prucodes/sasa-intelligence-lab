import snapshot from '@/data/aggregates/ulb-service-snapshot.json';

/**
 * The urban body code hiding inside `lgd_mandal_code`.
 *
 * The LGD-enriched exports put a code in `lgd_mandal_code`, and until October 2026 the
 * app read every value in that column as a ULB code. It is not one column. It carries two
 * code systems, and `code-defects.csv` logged the symptom as C1: 91 ULBs carry two values
 * for one place, and every one of those 91 carries exactly one from each of two bands that
 * never overlap. Checked on 3 October 2026, the evidence for what each band is:
 *
 * - the 1000 to 1299 band is the CDMA urban body code. For all 122 ULBs in the proposed
 *   registry that have such a value, it equals that ULB's `cdma_ulb_code` exactly, and every
 *   one of the 123 ULBs in the daily collection files is keyed on a code from this band;
 * - the 4800 to 5500 band is the LGD mandal code, which `aware_mandal_geo_api` returns as
 *   `Mndcodeind` for the same places (Gudur 05184, Ramachandrapuram 04924, Rajampet 05246).
 *
 * A mandal is not a ULB, so reading the second band as a ULB code names the wrong kind of
 * thing. That is what this module separates. Membership of the CDMA registry decides it
 * rather than a numeric threshold, because the registry is the source that issues those
 * codes: a code is an urban body code when the urban body register contains it, and no
 * boundary has to be guessed. Across the seven retained tables that carry the column, every
 * value in the first band is in the registry and no value in the second band is, so the two
 * tests agree on real data and nothing is inferred for a row that carries neither.
 *
 * The platform has not confirmed this reading. It is why `fix-pack/crosswalk-evidence.md`
 * asks for the two to be published as separate columns.
 */
type CodedRecord = Record<string, string | undefined>;

/** The CDMA urban body register, as the daily collection files key it. */
export const urbanBodyCodes: ReadonlySet<string> = new Set(snapshot.ulbs.map((ulb) => String(ulb.code)));

function declaredCode(record: CodedRecord): string | null {
  const value = (record.lgd_mandal_code ?? record.api_lgd_mandal_code ?? record.ulb_code)?.trim();
  return value && value.toLowerCase() !== 'null' ? value : null;
}

/**
 * The urban body code a row declares, or null. Null means the row carried a mandal code, or
 * no code at all; neither is a ULB identity and neither is guessed at from the name.
 */
export function urbanBodyCode(record: CodedRecord): string | null {
  const value = declaredCode(record);
  return value && urbanBodyCodes.has(value) ? value : null;
}

/** The LGD mandal code a row declares, kept apart so it is never read as a ULB. */
export function lgdMandalCode(record: CodedRecord): string | null {
  const value = declaredCode(record);
  return value && !urbanBodyCodes.has(value) ? value : null;
}

/** The identity key an urban body code stands for, shared with the daily service sources. */
export function urbanBodyIdentity(record: CodedRecord): string | null {
  const code = urbanBodyCode(record);
  return code ? `urban:${code}` : null;
}
