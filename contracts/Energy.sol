// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract EnergyTradeHub is ERC721URIStorage, ReentrancyGuard, AccessControl {
    using Address for address payable;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    uint256 public tokenCount = 0;

    struct EnergyToken {
        uint256 tokenId;
        address owner;
        string energyType;
        uint256 validFrom;
        uint256 validTo;
        uint256 startTime;
        uint256 endTime;
        uint256 amountInKw;
        uint256 balanceInKw;
    }

    struct TokenSale {
        bool isForSale;
        uint256 price;
    }

    mapping(uint256 => EnergyToken) public tokens;
    mapping(uint256 => TokenSale) public tokenSales;

    event TokenCreated(
        uint256 tokenId,
        address owner,
        string energyType,
        uint256 validFrom,
        uint256 validTo,
        uint256 startTime,
        uint256 endTime,
        uint256 amountInKw
    );
    event TokenListedForSale(uint256 tokenId, uint256 price);
    event TokenSaleWithdrawn(uint256 tokenId);
    event TokenPurchased(uint256 tokenId, address buyer, uint256 price);
    event TokenBurned(uint256 tokenId, address burner);

    constructor() ERC721("EnergyTradeHubToken", "ETHB") {
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(PROVIDER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CONSUMER_ROLE, ADMIN_ROLE);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return
            ERC721.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }

    function registerAsConsumer() public {
        grantRole(CONSUMER_ROLE, msg.sender);
    }

    function addProvider(address provider) public {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        grantRole(PROVIDER_ROLE, provider);
    }

    modifier onlyProvider() {
        require(hasRole(PROVIDER_ROLE, msg.sender), "Caller is not a provider");
        _;
    }

    function createToken(
        string memory energyType,
        uint256 validFrom,
        uint256 validTo,
        uint256 startTime,
        uint256 endTime,
        uint256 amountInKw,
        string memory tokenURI
    ) public onlyProvider returns (uint256) {
        require(startTime < endTime, "Start time must be before end time.");
        require(
            validFrom < validTo,
            "Valid from date must be before valid to date."
        );
        require(amountInKw > 0, "Amount of energy must be greater than 0 kW.");

        tokenCount++;
        uint256 newTokenId = tokenCount;
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        tokens[newTokenId] = EnergyToken(
            newTokenId,
            msg.sender,
            energyType,
            validFrom,
            validTo,
            startTime,
            endTime,
            amountInKw,
            amountInKw
        );

        emit TokenCreated(
            newTokenId,
            msg.sender,
            energyType,
            validFrom,
            validTo,
            startTime,
            endTime,
            amountInKw
        );
        return newTokenId;
    }

    function listTokenForSale(uint256 tokenId, uint256 price) public {
        require(
            ownerOf(tokenId) == msg.sender,
            "You must own the token to list it for sale."
        );
        tokenSales[tokenId] = TokenSale(true, price);
        emit TokenListedForSale(tokenId, price);
    }

    function withdrawTokenFromSale(uint256 tokenId) public {
        require(
            ownerOf(tokenId) == msg.sender,
            "You must own the token to withdraw it from sale."
        );
        tokenSales[tokenId].isForSale = false;
        emit TokenSaleWithdrawn(tokenId);
    }

    function buyToken(uint256 tokenId) public payable nonReentrant {
        require(tokenSales[tokenId].isForSale, "This token is not for sale.");
        require(
            msg.value >= tokenSales[tokenId].price,
            "Insufficient funds sent."
        );
        address seller = ownerOf(tokenId);

        _transfer(seller, msg.sender, tokenId);
        payable(seller).sendValue(msg.value);
        tokenSales[tokenId].isForSale = false;

        emit TokenPurchased(tokenId, msg.sender, tokenSales[tokenId].price);
    }

    function burnToken(uint256 tokenId) public {
        require(hasRole(CONSUMER_ROLE, msg.sender), "Caller is not a consumer");
        require(
            ownerOf(tokenId) == msg.sender,
            "You must own the token to burn it."
        );
        require(
            isWithinValidPeriod(tokenId),
            "The token is not within its valid usage period or time window."
        );

        _burn(tokenId);
        emit TokenBurned(tokenId, msg.sender);
    }

    function isWithinValidPeriod(uint256 tokenId) public view returns (bool) {
        EnergyToken memory token = tokens[tokenId];

        // Ensure the current timestamp is within the overall valid period
        bool isWithinDate = block.timestamp >= token.validFrom &&
            block.timestamp <= token.validTo;

        // Calculate the current time within the day in seconds
        uint256 timeOfDay = (block.timestamp % 86400);

        // Ensure the current time is within the valid daily time window
        bool isWithinTime = timeOfDay >= token.startTime &&
            timeOfDay <= token.endTime;

        return isWithinDate && isWithinTime;
    }
}
