source "https://rubygems.org"

git_source(:github) {|repo_name| "https://github.com/#{repo_name}" }

# gem "rails"
gem "jekyll", "~> 4.3.3"

# Pin dependencies for compatibility with older Ruby (e.g., macOS system Ruby 2.6)
# These constraints ensure the project builds locally on macOS and on CI (Linux/Ruby 3.x)
gem "jekyll-sass-converter", "~> 2.0" # Uses sassc instead of sass-embedded (which requires newer Ruby/glibc)
gem "public_suffix", "< 6.0"        # 6.0+ requires Ruby 3.0+
gem "ffi", "< 1.17.0"               # 1.17+ requires Ruby 3.0+

gem "minima"

group :jekyll_plugins do
  gem "jekyll-feed"
end

gem "logger", "~> 1.7"
gem "csv"
gem "base64"
gem "bigdecimal"
gem "mutex_m"


