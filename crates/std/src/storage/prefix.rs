use {
    super::{concat, extend_one_byte, increment_last_byte, nested_namespaces_with_key, trim},
    crate::{from_json, Bound, MapKey, Order, RawBound, RawKey, Storage},
    serde::de::DeserializeOwned,
    std::marker::PhantomData,
};

pub struct Prefix<K, T> {
    prefix:       Vec<u8>,
    _suffix_type: PhantomData<K>,
    _data_type:   PhantomData<T>,
}

impl<K, T> Prefix<K, T> {
    pub fn new(namespace: &[u8], prefixes: &[RawKey]) -> Self {
        Self {
            prefix:       nested_namespaces_with_key(Some(namespace), prefixes, None),
            _suffix_type: PhantomData,
            _data_type:   PhantomData,
        }
    }
}

impl<K, T> Prefix<K, T>
where
    K: MapKey,
    T: DeserializeOwned,
{
    #[allow(clippy::type_complexity)]
    pub fn range<'a>(
        &self,
        store: &'a dyn Storage,
        min:   Option<Bound<K>>,
        max:   Option<Bound<K>>,
        order: Order,
    ) -> anyhow::Result<Box<dyn Iterator<Item = anyhow::Result<(K::Output, T)>> + 'a>> {
        // compute start and end bounds
        // note that the store considers the start bounds as inclusive, and end
        // bound as exclusive (see the Storage trait)
        let min = match min.map(RawBound::from) {
            None => self.prefix.to_vec(),
            Some(RawBound::Inclusive(k)) => concat(&self.prefix, &k),
            Some(RawBound::Exclusive(k)) => extend_one_byte(concat(&self.prefix, &k)),
        };
        let max = match max.map(RawBound::from) {
            None => increment_last_byte(self.prefix.to_vec()),
            Some(RawBound::Inclusive(k)) => extend_one_byte(concat(&self.prefix, &k)),
            Some(RawBound::Exclusive(k)) => concat(&self.prefix, &k),
        };

        // need to make a clone of self.prefix and move it into the closure,
        // so that the iterator can live longer than &self.
        let prefix = self.prefix.clone();
        let iter = store.scan(Some(&min), Some(&max), order).map(move |item| {
            let (k, v) = item?;
            debug_assert_eq!(&k[0..prefix.len()], prefix, "Prefix mispatch");
            let key_bytes = trim(&prefix, &k);
            let key = K::deserialize(&key_bytes)?;
            let data = from_json(v)?;
            Ok((key, data))
        });

        Ok(Box::new(iter))
    }

    pub fn clear(&self, _store: &mut dyn Storage, _limit: Option<usize>) -> anyhow::Result<()> {
        todo!()
    }
}