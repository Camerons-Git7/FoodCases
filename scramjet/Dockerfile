FROM php:8.2-apache

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Install cURL extension
RUN docker-php-ext-install curl

# Set working directory
WORKDIR /var/www/html

# Copy all files to container
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# Start Apache in foreground
CMD ["apache2-foreground"]
