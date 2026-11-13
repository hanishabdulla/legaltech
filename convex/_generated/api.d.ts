/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adviser from "../adviser.js";
import type * as business from "../business.js";
import type * as cases from "../cases.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as firms from "../firms.js";
import type * as intake from "../intake.js";
import type * as integrations_index from "../integrations/index.js";
import type * as lawyer from "../lawyer.js";
import type * as legislation from "../legislation.js";
import type * as lib_actionPlan from "../lib/actionPlan.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_demoValues from "../lib/demoValues.js";
import type * as lib_facts from "../lib/facts.js";
import type * as lib_flags from "../lib/flags.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_legislationXml from "../lib/legislationXml.js";
import type * as lib_questions from "../lib/questions.js";
import type * as lib_referralPayload from "../lib/referralPayload.js";
import type * as lib_remedySchema from "../lib/remedySchema.js";
import type * as lib_schemes_index from "../lib/schemes/index.js";
import type * as lib_serviceLevel from "../lib/serviceLevel.js";
import type * as lib_traction from "../lib/traction.js";
import type * as matters from "../matters.js";
import type * as seed from "../seed.js";
import type * as seed_legislation from "../seed/legislation.js";
import type * as sessions from "../sessions.js";
import type * as traction from "../traction.js";
import type * as vouchers from "../vouchers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adviser: typeof adviser;
  business: typeof business;
  cases: typeof cases;
  contracts: typeof contracts;
  crons: typeof crons;
  documents: typeof documents;
  firms: typeof firms;
  intake: typeof intake;
  "integrations/index": typeof integrations_index;
  lawyer: typeof lawyer;
  legislation: typeof legislation;
  "lib/actionPlan": typeof lib_actionPlan;
  "lib/auth": typeof lib_auth;
  "lib/demoValues": typeof lib_demoValues;
  "lib/facts": typeof lib_facts;
  "lib/flags": typeof lib_flags;
  "lib/gemini": typeof lib_gemini;
  "lib/legislationXml": typeof lib_legislationXml;
  "lib/questions": typeof lib_questions;
  "lib/referralPayload": typeof lib_referralPayload;
  "lib/remedySchema": typeof lib_remedySchema;
  "lib/schemes/index": typeof lib_schemes_index;
  "lib/serviceLevel": typeof lib_serviceLevel;
  "lib/traction": typeof lib_traction;
  matters: typeof matters;
  seed: typeof seed;
  "seed/legislation": typeof seed_legislation;
  sessions: typeof sessions;
  traction: typeof traction;
  vouchers: typeof vouchers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
