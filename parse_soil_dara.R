# install.packages(c("tidyverse","hms","lubridate"))
library(tidyverse)
library(hms)
library(lubridate)

# 1. Read & filter lines
raw_lines  <- readr::read_lines("test_data.txt")
data_lines <- raw_lines[str_detect(raw_lines, "^V")]

# 2. Split each line into parts1, parts2, …  
df <- tibble(line = data_lines) %>%
  mutate(parts = str_split(line, "~")) %>%
  unnest_wider(parts, names_sep = "")

# 3. Extract metadata (first 10 parts)
df_meta <- df %>%
  transmute(
    ts       = parts1,
    fw       = parts2,
    project  = parts3,
    coords   = parts4,
    node_id  = parts5,
    batt_V   = as.numeric(parts6),
    enclT    = as.numeric(parts7),
    current  = as.numeric(parts8),
    solar_V  = as.numeric(parts9),
    meas_utc = parts10
  )

# 4. Build sensor columns in blocks of 7
sensor_fields <- c("addr","depth","vwc","temp","perm","bulk_ec","pore_ec")
num_sensors   <- (ncol(df) - 10) / 7

df_sensors <- map_dfc(seq_len(num_sensors), function(i){
  idx_cols <- paste0("parts", 10 + (i-1)*7 + seq_len(7))
  sub      <- df %>% select(all_of(idx_cols))
  names(sub) <- paste0(sensor_fields, "_S", i)
  # convert all except addr_Si to numeric
  sub %>% mutate(across(-starts_with("addr_"), as.numeric))
})

# 5. Combine and parse times
final_df <- bind_cols(df_meta, df_sensors) %>%
  mutate(
    ts       = hms(ts),
    meas_utc = ymd_hms(meas_utc)
  )

# 6. Inspect or save
print(final_df)
# write_csv(final_df, "soil_data_wide.csv")
