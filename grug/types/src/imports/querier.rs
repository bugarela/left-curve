use {
    crate::{
        Addr, Binary, Coins, Config, ContractInfo, Denom, Hash256, Json, JsonDeExt, JsonSerExt,
        Query, QueryRequest, QueryResponse, StdResult,
    },
    grug_math::Uint128,
    serde::{de::DeserializeOwned, ser::Serialize},
    std::collections::BTreeMap,
};

pub trait Querier {
    /// Make a query. This is the only method that the context needs to manually
    /// implement. The other methods will be implemented automatically.
    fn query_chain(&self, req: Query) -> StdResult<QueryResponse>;
}

/// Wraps around a `Querier` to provide some convenience methods.
///
/// This is necessary because the `query_wasm_smart` method involves generics,
/// and a traits with generic methods isn't object-safe (i.e. we won't be able
/// to do `&dyn Querier`).
pub struct QuerierWrapper<'a> {
    inner: &'a dyn Querier,
}

impl<'a> QuerierWrapper<'a> {
    pub fn new(inner: &'a dyn Querier) -> Self {
        Self { inner }
    }

    pub fn query(&self, req: Query) -> StdResult<QueryResponse> {
        self.inner.query_chain(req)
    }

    pub fn query_config(&self) -> StdResult<Config> {
        self.inner
            .query_chain(Query::Config {})
            .map(|res| res.as_config())
    }

    pub fn query_app_config<K, T>(&self, key: K) -> StdResult<T>
    where
        K: Into<String>,
        T: DeserializeOwned,
    {
        self.inner
            .query_chain(Query::AppConfig { key: key.into() })
            .and_then(|res| res.as_app_config().deserialize_json())
    }

    pub fn query_app_configs(
        &self,
        start_after: Option<String>,
        limit: Option<u32>,
    ) -> StdResult<BTreeMap<String, Json>> {
        self.inner
            .query_chain(Query::AppConfigs { start_after, limit })
            .map(|res| res.as_app_configs())
    }

    pub fn query_balance(&self, address: Addr, denom: Denom) -> StdResult<Uint128> {
        self.inner
            .query_chain(Query::Balance { address, denom })
            .map(|res| res.as_balance().amount)
    }

    pub fn query_balances(
        &self,
        address: Addr,
        start_after: Option<Denom>,
        limit: Option<u32>,
    ) -> StdResult<Coins> {
        self.inner
            .query_chain(Query::Balances {
                address,
                start_after,
                limit,
            })
            .map(|res| res.as_balances())
    }

    pub fn query_supply(&self, denom: Denom) -> StdResult<Uint128> {
        self.inner
            .query_chain(Query::Supply { denom })
            .map(|res| res.as_supply().amount)
    }

    pub fn query_supplies(
        &self,
        start_after: Option<Denom>,
        limit: Option<u32>,
    ) -> StdResult<Coins> {
        self.inner
            .query_chain(Query::Supplies { start_after, limit })
            .map(|res| res.as_supplies())
    }

    pub fn query_code(&self, hash: Hash256) -> StdResult<Binary> {
        self.inner
            .query_chain(Query::Code { hash })
            .map(|res| res.as_code())
    }

    pub fn query_codes(
        &self,
        start_after: Option<Hash256>,
        limit: Option<u32>,
    ) -> StdResult<BTreeMap<Hash256, Binary>> {
        self.inner
            .query_chain(Query::Codes { start_after, limit })
            .map(|res| res.as_codes())
    }

    pub fn query_contract(&self, address: Addr) -> StdResult<ContractInfo> {
        self.inner
            .query_chain(Query::Contract { address })
            .map(|res| res.as_contract())
    }

    pub fn query_contracts(
        &self,
        start_after: Option<Addr>,
        limit: Option<u32>,
    ) -> StdResult<BTreeMap<Addr, ContractInfo>> {
        self.inner
            .query_chain(Query::Contracts { start_after, limit })
            .map(|res| res.as_contracts())
    }

    pub fn query_wasm_raw<B>(&self, contract: Addr, key: B) -> StdResult<Option<Binary>>
    where
        B: Into<Binary>,
    {
        self.inner
            .query_chain(Query::WasmRaw {
                contract,
                key: key.into(),
            })
            .map(|res| res.as_wasm_raw())
    }

    pub fn query_wasm_smart<R>(&self, contract: Addr, req: R) -> StdResult<R::Response>
    where
        R: QueryRequest,
        R::Message: Serialize,
        R::Response: DeserializeOwned,
    {
        let msg = R::Message::from(req);

        self.inner
            .query_chain(Query::WasmSmart {
                contract,
                msg: msg.to_json_value()?,
            })
            .and_then(|res| res.as_wasm_smart().deserialize_json())
    }

    pub fn query_multi<const N: usize>(
        &self,
        requests: [Query; N],
    ) -> StdResult<[QueryResponse; N]> {
        self.inner
            .query_chain(Query::Multi(requests.into()))
            .map(|res| {
                // We trust that the host has properly implemented the multi
                // query method, meaning the number of responses should always
                // match the number of requests.
                let responses = res.as_multi();
                debug_assert_eq!(
                    responses.len(),
                    N,
                    "number of responses ({}) does not match that of requests ({})",
                    responses.len(),
                    N
                );
                responses.try_into().unwrap()
            })
    }
}
