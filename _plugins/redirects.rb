# Copyright AGNTCY Contributors (https://github.com/agntcy)
# SPDX-License-Identifier: CC-BY-4.0
# frozen_string_literal: true

require "cgi"
require "json"

module Jekyll
  # Static HTML redirects for moved posts and pages.
  #
  # GitHub Pages cannot emit HTTP 301/302 for a static site, so this generator
  # writes an HTML file at each old path (the same approach as mkdocs-redirects
  # on the docs site). Browsers follow the meta refresh and JavaScript location
  # change; search engines see rel=canonical and noindex.
  #
  # Configure a central map in _config.yml:
  #
  #   redirects:
  #     /old/path.html: /new/path.html
  #
  # Or attach old paths to the destination document:
  #
  #   redirect_from:
  #     - /old/path.html
  class RedirectPage < PageWithoutAFile
    def initialize(site, from, dest, canonical)
      super(site, site.source, "", redirect_filename(from))
      data["layout"] = nil
      data["sitemap"] = false
      data["permalink"] = from
      self.content = redirect_html(dest, canonical)
    end

    private

    def redirect_filename(from)
      "redirect#{from.gsub(/[^\w]+/, "-")}.html"
    end

    def redirect_html(dest, canonical)
      href = CGI.escapeHTML(dest)
      canon = CGI.escapeHTML(canonical)
      <<~HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Redirecting&hellip;</title>
          <link rel="canonical" href="#{canon}">
          <meta name="robots" content="noindex">
          <meta http-equiv="refresh" content="0;url=#{href}">
          <script>location.replace(#{JSON.generate(dest)} + location.hash)</script>
        </head>
        <body>
          Redirecting to <a href="#{href}">#{href}</a>&hellip;
        </body>
        </html>
      HTML
    end
  end

  class RedirectsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      existing = existing_urls(site)
      redirects = {}

      (site.config["redirects"] || {}).each do |from, to|
        register(redirects, from, to, existing)
      end

      (site.pages + site.posts.docs).each do |doc|
        Array(doc.data["redirect_from"]).flatten.compact.each do |from|
          register(redirects, from, doc.url, existing)
        end
      end

      redirects.each do |from, to|
        unless to.start_with?("https://") || existing[to]
          Jekyll.logger.warn "Redirects:", "Target does not exist: #{to} (from #{from})"
        end
        dest = resolve_dest(site, to)
        site.pages << RedirectPage.new(site, from, dest, canonical_url(site, dest))
      end
    end

    private

    def existing_urls(site)
      (site.pages + site.posts.docs).each_with_object({}) do |doc, urls|
        urls[doc.url] = true
      end
    end

    def register(redirects, from, to, existing)
      from = normalize_path(from)
      to = to.to_s.strip
      unless valid_target?(to)
        Jekyll.logger.warn "Redirects:", "Skipping #{from}: invalid target #{to.inspect}"
        return
      end
      if existing[from]
        Jekyll.logger.warn "Redirects:", "Skipping #{from}: a page already exists at that path"
        return
      end
      if redirects.key?(from) && redirects[from] != to
        Jekyll.logger.warn "Redirects:", "Duplicate #{from}: keeping #{to} (was #{redirects[from]})"
      end
      redirects[from] = to
    end

    def normalize_path(path)
      path = path.to_s.strip
      path = "/#{path}" unless path.start_with?("/")
      path
    end

    def valid_target?(to)
      to.start_with?("/", "https://")
    end

    def resolve_dest(site, to)
      return to if to.start_with?("https://")

      "#{site.baseurl.to_s.chomp("/")}#{to}"
    end

    def canonical_url(site, dest)
      return dest if dest.start_with?("https://")

      "#{site.config["url"].to_s.chomp("/")}#{dest}"
    end
  end
end
