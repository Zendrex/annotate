/** biome-ignore-all lint/complexity/noVoid: discard references to avoid unused-variable warnings in type tests */
import { mintListKey, mintUniqueKey } from "../../../src/metadata/cardinality-registry";
import type { ListMetadataKey, MetadataKey, UniqueMetadataKey } from "../../../src/metadata/types";

// --- UniqueMetadataKey<X> is assignable to symbol ---

declare const uniqueKey: UniqueMetadataKey<string>;

// A branded key must widen to plain symbol without error.
const _sym: symbol = uniqueKey;
void _sym;

// --- Bare symbol is NOT assignable to UniqueMetadataKey<X> ---

declare const bare: symbol;

// @ts-expect-error: bare symbol must not satisfy the brand
const _branded: UniqueMetadataKey<string> = bare;
void _branded;

// --- MetadataKey<X, "unique"> is not assignable to MetadataKey<X, "list"> ---

declare const uniqueMeta: MetadataKey<string, "unique">;

// @ts-expect-error: cardinality mismatch — unique key is not a list key
const _asList: MetadataKey<string, "list"> = uniqueMeta;
void _asList;

// --- ListMetadataKey<X> is assignable to symbol ---

declare const listKey: ListMetadataKey<number>;

const _listSym: symbol = listKey;
void _listSym;

// --- Mint helpers return the correct branded types ---

const minted = mintUniqueKey<string>("type-test");
const _mintedCheck: UniqueMetadataKey<string> = minted;
void _mintedCheck;

const mintedList = mintListKey<number>("type-test-list");
const _mintedListCheck: ListMetadataKey<number> = mintedList;
void _mintedListCheck;

// --- MetadataKey with no params (default) is still compatible with symbol ---

declare const defaultKey: MetadataKey;
const _defaultSym: symbol = defaultKey;
void _defaultSym;
