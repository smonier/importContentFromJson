    <%@ page language="java" contentType="text/javascript" %>
    <%@ taglib prefix="jcr" uri="http://www.jahia.org/tags/jcr" %>
    <%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
    <%@ taglib prefix="utility" uri="http://www.jahia.org/tags/utilityLib" %>
    <%@ taglib prefix="functions" uri="http://www.jahia.org/tags/functions"%>

    <c:set var="unsplashConfig" value="${functions:getConfigValues('org.jahia.se.modules.importContentFromJson')}"/>
    <%--<utility:logger level="debug" value="keepeekConfig : ${keepeekConfig}"/>--%>

    <c:choose>
    <c:when test="${! empty unsplashConfig}">
    window.contextJsParameters.config.unsplashConfig={
        accessKey:"${unsplashConfig['unsplash.accessKey']}"
    }
    console.debug("%c Unsplash config is added to contextJsParameters.config", 'color: #3c8cba');
    </c:when>
    <c:otherwise>
    <utility:logger level="warn" value="Unsplash Config retrieval faile"/>
    console.warn("Unsplash Config retrieval failed");
    </c:otherwise>
    </c:choose>