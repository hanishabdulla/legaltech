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
import type * as cases from "../cases.js";
import type * as documents from "../documents.js";
import type * as intake from "../intake.js";
import type * as integrations_index from "../integrations/index.js";
import type * as lib_actionPlan from "../lib/actionPlan.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_demoValues from "../lib/demoValues.js";
import type * as lib_facts from "../lib/facts.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_questions from "../lib/questions.js";
import type * as lib_referralPayload from "../lib/referralPayload.js";
import type * as lib_schemes_index from "../lib/schemes/index.js";
import type * as sessions from "../sessions.js";
import type * as vouchers from "../vouchers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adviser: typeof adviser;
  cases: typeof cases;
  documents: typeof documents;
  intake: typeof intake;
  "integrations/index": typeof integrations_index;
  "lib/actionPlan": typeof lib_actionPlan;
  "lib/auth": typeof lib_auth;
  "lib/demoValues": typeof lib_demoValues;
  "lib/facts": typeof lib_facts;
  "lib/gemini": typeof lib_gemini;
  "lib/questions": typeof lib_questions;
  "lib/referralPayload": typeof lib_referralPayload;
  "lib/schemes/index": typeof lib_schemes_index;
  sessions: typeof sessions;
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

export declare const components: {};
