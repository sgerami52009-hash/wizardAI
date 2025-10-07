#!/bin/bash
# Script to find Jetson devices on the network

set -e

# Default network range
NETWORK_RANGE="192.168.1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Parse command line arguments
usage() {
    echo "Usage: $0 [-n NETWORK_RANGE]"
    echo "  -n NETWORK_RANGE  Network range to scan (default: 192.168.1)"
    echo "  -h                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Scan 192.168.1.0/24"
    echo "  $0 -n 192.168.0      # Scan 192.168.0.0/24"
    echo "  $0 -n 10.0.0         # Scan 10.0.0.0/24"
    exit 1
}

while getopts "n:h" opt; do
    case $opt in
        n) NETWORK_RANGE="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

echo -e "${CYAN}🔍 Searching for Jetson devices on network...${NC}"
echo -e "${YELLOW}Network range: $NETWORK_RANGE.0/24${NC}"

# Function to test if a host is reachable and get hostname
test_jetson_host() {
    local host_ip="$1"
    
    if ping -c 1 -W 2 "$host_ip" >/dev/null 2>&1; then
        # Try to get hostname
        hostname=$(nslookup "$host_ip" 2>/dev/null | grep "name =" | cut -d'=' -f2 | tr -d ' ' || echo "Unknown")
        if [ "$hostname" = "" ]; then
            hostname="Unknown"
        fi
        echo "$host_ip|$hostname|true"
    fi
}

# Scan network range
echo -e "${YELLOW}Scanning network range ${NETWORK_RANGE}.1-254...${NC}"

found_devices=()
for i in {1..254}; do
    ip="$NETWORK_RANGE.$i"
    printf "\rScanning: %-15s [%3d/254]" "$ip" "$i"
    
    result=$(test_jetson_host "$ip")
    if [ -n "$result" ]; then
        found_devices+=("$result")
        echo -e "\n${GREEN}Found device: $ip${NC}"
    fi
done

echo -e "\n"

# Display results
echo -e "📋 ${BLUE}Network Scan Results:${NC}"
echo -e "${BLUE}========================${NC}"

if [ ${#found_devices[@]} -eq 0 ]; then
    echo -e "${RED}❌ No devices found on network ${NETWORK_RANGE}.0/24${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting suggestions:${NC}"
    echo -e "${NC}1. Make sure your Jetson is powered on${NC}"
    echo -e "${NC}2. Check network connection (Ethernet/WiFi)${NC}"
    echo -e "${NC}3. Try a different network range:${NC}"
    echo -e "${GRAY}   $0 -n 192.168.0${NC}"
    echo -e "${GRAY}   $0 -n 10.0.0${NC}"
else
    echo -e "${GREEN}✅ Found ${#found_devices[@]} device(s):${NC}"
    echo ""
    
    for device in "${found_devices[@]}"; do
        IFS='|' read -r ip hostname reachable <<< "$device"
        echo -e "🖥️  ${CYAN}IP: $ip${NC}"
        echo -e "   ${NC}Hostname: $hostname${NC}"
        
        # Check if it might be a Jetson
        if [[ "$hostname" =~ jetson|nano|orin ]] || [ "$hostname" = "Unknown" ]; then
            echo -e "   ${YELLOW}⭐ Possible Jetson device!${NC}"
        fi
        echo ""
    done
    
    echo -e "🔧 ${BLUE}To use a specific IP for deployment:${NC}"
    echo -e "${GRAY}export JETSON_HOST='192.168.1.XXX'${NC}"
    echo -e "${GRAY}./deployment/deploy-jetson.sh${NC}"
fi

# Test specific Jetson hostnames
echo -e "${CYAN}🔍 Testing common Jetson hostnames...${NC}"
common_names=("jetson-nano.local" "jetson.local" "nano.local" "orin.local")

for name in "${common_names[@]}"; do
    if ping -c 1 -W 3 "$name" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is reachable!${NC}"
    else
        echo -e "${RED}❌ $name is not reachable${NC}"
    fi
done

echo -e "\n📚 ${BLUE}Next Steps:${NC}"
echo -e "${NC}1. If you found your Jetson, use its IP address${NC}"
echo -e "${NC}2. If no Jetson found, check physical connections${NC}"
echo -e "${NC}3. Consider using USB deployment instead${NC}"