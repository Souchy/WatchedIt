use std::error::Error;


// Generic retry helper for batch inserts with binary search fallback
pub fn batch_insert_with_retry<T, F, G>(
    items: &[T],
    mut try_insert: F,
    get_id: G,
    type_name: &str,
    depth: usize,
) -> Result<(), Box<dyn Error>>
where
    F: FnMut(&[T]) -> Result<(), Box<dyn Error>>,
    G: Fn(&T) -> Option<i32>,
{
    batch_insert_with_retry_impl(items, &mut try_insert, &get_id, type_name, depth)
}

fn batch_insert_with_retry_impl<T, G>(
    items: &[T],
    try_insert: &mut dyn FnMut(&[T]) -> Result<(), Box<dyn Error>>,
    get_id: &G,
    type_name: &str,
    depth: usize,
) -> Result<(), Box<dyn Error>>
where
    G: Fn(&T) -> Option<i32>,
{
    if items.is_empty() {
        return Ok(());
    }

    // If only one item, try to insert it individually and skip on error
    if items.len() == 1 {
        let result = try_insert(items);
        if let Err(e) = result {
            eprintln!(
                "Skipping {} id {} due to error: {:#?}",
                type_name,
                get_id(&items[0]).unwrap_or(-1),
                e
            );
        }
        return Ok(());
    }

    // Try to insert the whole batch
    let result = try_insert(items);
    if result.is_ok() {
        return Ok(());
    } else if let Err(ref e) = result {
        eprintln!(
            "Batch of {} {} records failed, splitting to isolate error: {:#?}",
            items.len(),
            type_name,
            e
        );
    }

    // If failed, split in half and retry each half
    if depth < 20 {
        let mid = items.len() / 2;
        let (left, right) = items.split_at(mid);
        batch_insert_with_retry_impl(left, try_insert, get_id, type_name, depth + 1)?;
        batch_insert_with_retry_impl(right, try_insert, get_id, type_name, depth + 1)?;
        Ok(())
    } else {
        Err("Max retry depth reached".into())
    }
}
