pub struct Validator {
    min_length: usize,
    max_length: usize,
}

impl Validator {
    pub fn new(min_length: usize, max_length: usize) -> Self {
        Validator { min_length, max_length }
    }

    pub fn validate(&self, input: &str) -> Result<String, String> {
        if input.len() < self.min_length {
            return Err(format!(
                "Input too short: minimum {} characters",
                self.min_length
            ));
        }
        if input.len() > self.max_length {
            return Err(format!(
                "Input too long: maximum {} characters",
                self.max_length
            ));
        }
        Ok(input.to_string())
    }

    pub fn is_valid(&self, input: &str) -> bool {
        input.len() >= self.min_length && input.len() <= self.max_length
    }
}
